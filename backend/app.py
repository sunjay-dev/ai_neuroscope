"""AI Neuroscope backend.

Loads a small GPT-2 model locally and dissects it with PyTorch hooks:

- a forward pre-hook on every attention block's output projection (c_proj)
  captures each head's individual contribution to the residual stream, so we
  can say how strongly *each attention head* fires for each token;
- a forward hook on every MLP activation function captures per-neuron firing
  values (3072 neurons/layer);
- output_attentions captures every head's attention pattern (where it looks).

At startup we also run labeled probe sets (see concepts.py) through the model
and score every head and neuron by how selectively it fires for a concept
(gender, sentiment, sarcasm, royalty, ...). That is what lets the dashboard
say "Layer 2 · Head 3 is firing because of royalty" from real measurements.
"""

import os
import threading
import uuid
from collections import OrderedDict
from pathlib import Path
from typing import List, Optional

import numpy as np
import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from transformers import GPT2LMHeadModel, GPT2Tokenizer

from .concepts import CALIBRATION_SENTENCES, CONCEPTS, NEUTRAL_WORDS

MODEL_NAME = os.environ.get("NEUROSCOPE_MODEL", "gpt2")
MAX_TOKENS = 32
MAX_CACHE = 20
BATCH_SIZE = 32
TOP_NEURONS_PER_CELL = 3
CIRCUIT_HEADS = 6
CIRCUIT_NEURONS = 12
LABEL_MIN_D = 2.0  # effect size below this is reported as "no clear concept"
DETECT_Z = 1.6  # circuit reading this far above ordinary text = concept detected

app = FastAPI(title="AI Neuroscope")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

tokenizer = GPT2Tokenizer.from_pretrained(MODEL_NAME)
model = GPT2LMHeadModel.from_pretrained(MODEL_NAME, attn_implementation="eager")
model.eval()
# Inference only; frozen params also keep request worker threads grad-free.
model.requires_grad_(False)

NUM_LAYERS = model.config.n_layer
NUM_HEADS = model.config.n_head
D_MODEL = model.config.n_embd
D_HEAD = D_MODEL // NUM_HEADS
MLP_DIM = model.config.n_inner or 4 * D_MODEL
NUM_HEAD_UNITS = NUM_LAYERS * NUM_HEADS
BOS = tokenizer.bos_token_id

_model_lock = threading.Lock()
_head_norms: dict = {}  # layer -> (batch, seq, heads)
_mlp_acts: dict = {}  # layer -> (batch, seq, mlp_dim)


def _make_head_hook(layer_idx: int):
    # c_proj is a Conv1D (out = x @ W + b) whose input is the concatenation of
    # all heads' outputs. Splitting W by head gives each head's own write into
    # the residual stream; its norm is how hard that head "fires".
    w = model.transformer.h[layer_idx].attn.c_proj.weight.view(NUM_HEADS, D_HEAD, D_MODEL)

    def hook(_module, args):
        x = args[0]
        b, s, _ = x.shape
        z = x.view(b, s, NUM_HEADS, D_HEAD)
        _head_norms[layer_idx] = torch.einsum("bshd,hdm->bshm", z, w).norm(dim=-1)

    return hook


def _make_mlp_hook(layer_idx: int):
    def hook(_module, _inp, out):
        _mlp_acts[layer_idx] = out.detach()

    return hook


for _i, _block in enumerate(model.transformer.h):
    _block.attn.c_proj.register_forward_pre_hook(_make_head_hook(_i))
    _block.mlp.act.register_forward_hook(_make_mlp_hook(_i))


def _encode(text: str) -> List[int]:
    # A leading BOS token absorbs GPT-2's "attention sink" outlier activations,
    # which would otherwise land on (and drown out) the user's first word.
    return [BOS] + tokenizer.encode(text)


def _forward(id_lists: List[List[int]], want_attn: bool = False):
    """Run a right-padded batch. Returns (model output, heads (B,L,S,H), mlp (B,L,S,D))."""
    max_len = max(len(x) for x in id_lists)
    ids = torch.full((len(id_lists), max_len), BOS, dtype=torch.long)
    mask = torch.zeros_like(ids)
    for i, seq in enumerate(id_lists):
        ids[i, : len(seq)] = torch.tensor(seq)
        mask[i, : len(seq)] = 1
    with _model_lock:
        _head_norms.clear()
        _mlp_acts.clear()
        with torch.no_grad():
            out = model(input_ids=ids, attention_mask=mask, output_attentions=want_attn)
        heads = torch.stack([_head_norms[l] for l in range(NUM_LAYERS)], dim=1)
        mlp = torch.stack([_mlp_acts[l] for l in range(NUM_LAYERS)], dim=1)
    return out, heads, mlp



def _unit_matrix(heads: torch.Tensor, mlp: torch.Tensor) -> np.ndarray:
    """(L,S,H) head norms + (L,S,D) neuron acts -> (S, units) matrix, one row per token."""
    s = heads.shape[1]
    return np.concatenate(
        [heads.permute(1, 0, 2).reshape(s, -1).numpy(), mlp.permute(1, 0, 2).reshape(s, -1).numpy()],
        axis=1,
    ).astype(np.float32)


def _run_texts(texts: List[str]) -> List[np.ndarray]:
    """Per text, its (tokens, units) matrix (BOS position dropped)."""
    mats = []
    for start in range(0, len(texts), BATCH_SIZE):
        id_lists = [_encode(t) for t in texts[start : start + BATCH_SIZE]]
        _, heads, mlp = _forward(id_lists)
        for b, ids in enumerate(id_lists):
            n = len(ids)
            mats.append(_unit_matrix(heads[b, :, 1:n, :], mlp[b, :, 1:n, :]))
    return mats


def _probe_text(concept: dict, item: str) -> str:
    return item if concept["kind"] == "sentence" else " " + item


# ---------------------------------------------------------------- startup probe

print(f"[neuroscope] loaded {MODEL_NAME}; running concept probes…", flush=True)

_pool_texts: List[str] = []
_pool_index: dict = {}


def _pool_add(text: str) -> int:
    if text not in _pool_index:
        _pool_index[text] = len(_pool_texts)
        _pool_texts.append(text)
    return _pool_index[text]


_concept_sides = {}
for _key, _c in CONCEPTS.items():
    _concept_sides[_key] = (
        [_pool_add(_probe_text(_c, x)) for x in _c["a"]],
        [_pool_add(_probe_text(_c, x)) for x in _c["b"]],
    )

# Each probe text is summarised by the mean activation over its tokens.
_pool_mats = _run_texts(_pool_texts)
POOL = np.stack([m.mean(axis=0) for m in _pool_mats])  # (texts, units)
# Ordinary text, one row per token: the "typical activity" reference.
CALIB = np.concatenate(_run_texts(CALIBRATION_SENTENCES), axis=0)  # (tokens, units)

_all_tokens = np.concatenate(_pool_mats + [CALIB], axis=0)
UNIT_MU = _all_tokens.mean(axis=0)
_sd = _all_tokens.std(axis=0)
del _pool_mats, _all_tokens
# Floor tiny spreads (dead-ish neurons) so z-scores don't explode on noise.
_sd[:NUM_HEAD_UNITS] = np.maximum(_sd[:NUM_HEAD_UNITS], 0.05 * UNIT_MU[:NUM_HEAD_UNITS].mean())
_sd[NUM_HEAD_UNITS:] = np.maximum(_sd[NUM_HEAD_UNITS:], 0.05)
UNIT_SD = _sd

# Words (not sentences) that can be shown as "words that also fire this unit".
_pool_word_idx = np.array(
    [i for i, t in enumerate(_pool_texts) if len(t.split()) == 1], dtype=np.int64
)


def _contrast(a: np.ndarray, b: np.ndarray):
    """Cohen's d per unit between two groups of unit vectors."""
    mean_a, mean_b = a.mean(axis=0), b.mean(axis=0)
    pooled = np.sqrt((a.var(axis=0) + b.var(axis=0)) / 2 + (0.25 * UNIT_SD) ** 2)
    return (mean_a - mean_b) / pooled, (mean_a + mean_b) / 2, pooled


def _selectivity(d: np.ndarray, binary: bool) -> np.ndarray:
    # Binary concepts are meaningful in both directions (feminine vs masculine);
    # unary ones only count when the unit fires *more* for the concept.
    return np.abs(d) if binary else np.maximum(d, 0)


class Circuit:
    """A concept's most selective heads + neurons, read out as a linear vote."""

    def __init__(self, name, side_a, side_b, binary, d, mid, pooled):
        self.name, self.side_a, self.side_b, self.binary = name, side_a, side_b, binary
        score = _selectivity(d, binary)
        heads = np.argsort(-score[:NUM_HEAD_UNITS])[:CIRCUIT_HEADS]
        neurons = np.argsort(-score[NUM_HEAD_UNITS:])[:CIRCUIT_NEURONS] + NUM_HEAD_UNITS
        self.uids = np.concatenate([heads, neurons])
        self.is_head = self.uids < NUM_HEAD_UNITS
        self.d = d[self.uids]
        self.toward_a = np.where(self.d >= 0, 1.0, -1.0)
        self.mid = mid[self.uids]
        self.pooled = pooled[self.uids]
        _, votes = self.evaluate(CALIB)
        self.base_mu, self.base_sd = float(votes.mean()), float(votes.std() + 1e-6)

    def evaluate(self, units: np.ndarray):
        """units (S, U) -> per-unit evidence (S, k) and side-A vote per token (S,).

        evidence > 0 means the unit fires the way its preferred side does.
        """
        evidence = np.clip((units[:, self.uids] - self.mid) / self.pooled, -6, 6)
        return evidence, (evidence * self.toward_a).mean(axis=1)

    def read(self, units: np.ndarray):
        """Per token: z-score of the vote vs ordinary text, and the unit driving it."""
        evidence, votes = self.evaluate(units)
        z = (votes - self.base_mu) / self.base_sd
        # Contribution of each unit toward whichever side the token leans.
        contrib = evidence * self.toward_a * np.sign(z)[:, None]
        witness = {}
        for kind, mask in (("head", self.is_head), ("neuron", ~self.is_head)):
            local = np.where(mask)[0]
            best = local[contrib[:, local].argmax(axis=1)]
            witness[kind] = [_unit_from_id(int(self.uids[i]))[1:] for i in best]
        return evidence, z, witness

    def side_for(self, z: float) -> Optional[str]:
        if z >= DETECT_Z:
            return self.side_a
        if self.binary and z <= -DETECT_Z:
            return self.side_b
        return None


CONCEPT_KEYS = list(CONCEPTS.keys())
CONCEPT_BINARY = {k: CONCEPTS[k]["b"] is not NEUTRAL_WORDS for k in CONCEPT_KEYS}
_D = []
CIRCUITS = {}
for _key in CONCEPT_KEYS:
    _c = CONCEPTS[_key]
    _a_idx, _b_idx = _concept_sides[_key]
    _d, _mid, _pooled = _contrast(POOL[_a_idx], POOL[_b_idx])
    _D.append(_d)
    CIRCUITS[_key] = Circuit(
        _c["name"], _c["side_a"], _c["side_b"], CONCEPT_BINARY[_key], _d, _mid, _pooled
    )
CONCEPT_D = np.stack(_D).astype(np.float32)  # (concepts, units)
CONCEPT_SCORE = np.stack(
    [_selectivity(CONCEPT_D[i], CONCEPT_BINARY[k]) for i, k in enumerate(CONCEPT_KEYS)]
)

print(f"[neuroscope] probed {len(_pool_texts)} texts across {len(CONCEPTS)} concepts; ready.", flush=True)


# ------------------------------------------------------------------ helpers


def _unit_id(kind: str, layer: int, index: int) -> int:
    if kind == "head":
        return layer * NUM_HEADS + index
    return NUM_HEAD_UNITS + layer * MLP_DIM + index


def _unit_from_id(uid: int):
    if uid < NUM_HEAD_UNITS:
        return "head", uid // NUM_HEADS, uid % NUM_HEADS
    uid -= NUM_HEAD_UNITS
    return "neuron", uid // MLP_DIM, uid % MLP_DIM


def _concept_label(ci: int, uid: int) -> dict:
    key = CONCEPT_KEYS[ci]
    c = CONCEPTS[key]
    d = float(CONCEPT_D[ci, uid])
    return {
        "key": key,
        "name": c["name"],
        "side": c["side_a"] if d >= 0 else c["side_b"],
        "d": round(d, 2),
    }


def _best_label(uid: int) -> Optional[dict]:
    ci = int(CONCEPT_SCORE[:, uid].argmax())
    if CONCEPT_SCORE[ci, uid] < LABEL_MIN_D:
        return None
    return _concept_label(ci, uid)


HEAD_LABELS = [
    [_best_label(_unit_id("head", l, h)) for h in range(NUM_HEADS)] for l in range(NUM_LAYERS)
]

# analysis_id -> {"units": (S, units) matrix, "tokens": [...]}
_cache: "OrderedDict[str, dict]" = OrderedDict()


def _get_analysis(analysis_id: str) -> dict:
    entry = _cache.get(analysis_id)
    if entry is None:
        raise HTTPException(404, "analysis not found (it may have expired) — re-run the analysis")
    return entry


def _r(arr, nd=3):
    return np.round(np.asarray(arr, dtype=np.float64), nd).tolist()


# --------------------------------------------------------------------- API


class AnalyzeRequest(BaseModel):
    text: str


@app.post("/api/analyze")
def analyze(req: AnalyzeRequest):
    text = req.text.strip()
    if not text:
        raise HTTPException(400, "text is required")

    all_ids = _encode(text)
    ids = all_ids[: MAX_TOKENS + 1]
    if len(ids) < 2:
        raise HTTPException(400, "text produced no tokens")
    out, heads, mlp = _forward([ids], want_attn=True)
    heads = heads[0, :, 1:, :]  # (L, S, H) — drop BOS position
    mlp = mlp[0, :, 1:, :]  # (L, S, D)
    seq = heads.shape[1]
    tokens = [tokenizer.decode([t]) for t in ids[1:]]
    units = _unit_matrix(heads, mlp)
    z_all = (units - UNIT_MU) / UNIT_SD

    head_z = z_all[:, :NUM_HEAD_UNITS].reshape(seq, NUM_LAYERS, NUM_HEADS).transpose(1, 2, 0)

    mlp_z = torch.from_numpy(z_all[:, NUM_HEAD_UNITS:].reshape(seq, NUM_LAYERS, MLP_DIM))
    top_z, top_idx = mlp_z.topk(TOP_NEURONS_PER_CELL, dim=-1)  # (S, L, k)
    neuron_top = [
        [
            [
                {
                    "neuron": (n := int(top_idx[t, l, k])),
                    "z": round(float(top_z[t, l, k]), 2),
                    "label": _best_label(_unit_id("neuron", l, n)),
                }
                for k in range(TOP_NEURONS_PER_CELL)
            ]
            for t in range(seq)
        ]
        for l in range(NUM_LAYERS)
    ]

    # Read every concept circuit over the sentence: which tokens carry which
    # concept, and which specific head / neuron is driving that reading.
    concepts = {}
    token_concepts = [[] for _ in range(seq)]
    for key, circuit in CIRCUITS.items():
        _, z, witness = circuit.read(units)
        concepts[key] = {"z": _r(z, 2), "head": witness["head"], "neuron": witness["neuron"]}
        for t in range(seq):
            side = circuit.side_for(float(z[t]))
            if side:
                token_concepts[t].append(
                    {"key": key, "name": circuit.name, "side": side, "z": round(float(z[t]), 2)}
                )
    for found in token_concepts:
        found.sort(key=lambda c: -abs(c["z"]))

    attn = torch.stack(out.attentions, dim=0)[:, 0]  # (L, H, S+1, S+1)
    attention = attn[:, :, 1:, 1:]  # query/key over user tokens only
    sink = attn[:, :, 1:, 0]  # share of attention parked on BOS

    probs = out.logits[0, 1:].softmax(dim=-1)
    p_top, p_idx = probs.topk(3, dim=-1)
    predictions = [
        [{"token": tokenizer.decode([int(p_idx[t, k])]), "p": round(float(p_top[t, k]), 3)}
         for k in range(3)]
        for t in range(seq)
    ]

    analysis_id = uuid.uuid4().hex
    _cache[analysis_id] = {"units": units, "tokens": tokens}
    while len(_cache) > MAX_CACHE:
        _cache.popitem(last=False)

    return {
        "analysis_id": analysis_id,
        "tokens": tokens,
        "num_layers": NUM_LAYERS,
        "num_heads": NUM_HEADS,
        "mlp_dim": MLP_DIM,
        "head_z": _r(head_z, 2),
        "head_labels": HEAD_LABELS,
        "attention": _r(attention, 3),
        "attention_sink": _r(sink, 3),
        "neuron_top": neuron_top,
        "concepts": concepts,
        "token_concepts": token_concepts,
        "predictions": predictions,
        "truncated": len(all_ids) > MAX_TOKENS + 1,
    }


@app.get("/api/unit/{analysis_id}")
def unit_detail(analysis_id: str, kind: str, layer: int, index: int):
    """Everything the details panel shows for one attention head or MLP neuron."""
    if kind not in ("head", "neuron"):
        raise HTTPException(400, "kind must be 'head' or 'neuron'")
    if not (0 <= layer < NUM_LAYERS):
        raise HTTPException(400, "invalid layer")
    if not (0 <= index < (NUM_HEADS if kind == "head" else MLP_DIM)):
        raise HTTPException(400, "invalid index")
    entry = _get_analysis(analysis_id)
    uid = _unit_id(kind, layer, index)

    acts = entry["units"][:, uid]
    z = (acts - UNIT_MU[uid]) / UNIT_SD[uid]

    order = np.argsort(-CONCEPT_SCORE[:, uid])[:3]
    concepts = [
        {**_concept_label(int(ci), uid), "score": round(float(CONCEPT_SCORE[ci, uid]), 2)}
        for ci in order
    ]

    pool_vals = POOL[_pool_word_idx, uid]
    best = np.argsort(-pool_vals)[:8]
    top_words = [
        {
            "word": _pool_texts[_pool_word_idx[i]].strip(),
            "z": round(float((pool_vals[i] - UNIT_MU[uid]) / UNIT_SD[uid]), 2),
        }
        for i in best
    ]

    promotes = None
    if kind == "neuron":
        # Direct logit effect: which next tokens this neuron's output vector pushes up.
        w_out = model.transformer.h[layer].mlp.c_proj.weight[index]  # (d_model,)
        logits = (w_out * model.transformer.ln_f.weight) @ model.transformer.wte.weight.T
        promotes = [tokenizer.decode([int(i)]) for i in logits.topk(8).indices]

    return {
        "kind": kind,
        "layer": layer,
        "index": index,
        "label": _best_label(uid),
        "concepts": concepts,
        "all_concepts": {
            k: {**_concept_label(ci, uid), "score": round(float(CONCEPT_SCORE[ci, uid]), 2)}
            for ci, k in enumerate(CONCEPT_KEYS)
        },
        "top_words": top_words,
        "sentence_act": _r(acts, 3),
        "sentence_z": _r(z, 2),
        "promotes": promotes,
    }


class ConceptRequest(BaseModel):
    analysis_id: str
    key: Optional[str] = None
    words_a: Optional[List[str]] = None
    words_b: Optional[List[str]] = None


@app.post("/api/concept")
def concept_circuit(req: ConceptRequest):
    """A concept's circuit (top heads + neurons) traced through the analyzed sentence."""
    entry = _get_analysis(req.analysis_id)

    if req.key:
        circuit = CIRCUITS.get(req.key)
        if circuit is None:
            raise HTTPException(404, f"unknown concept '{req.key}'")
    else:
        words_a = [w.strip() for w in (req.words_a or []) if w.strip()]
        words_b = [w.strip() for w in (req.words_b or []) if w.strip()]
        if len(words_a) < 2 or len(words_b) < 2:
            raise HTTPException(400, "give at least 2 words on each side")
        if len(words_a) + len(words_b) > 80:
            raise HTTPException(400, "too many words (max 80 total)")
        vecs = np.stack([m.mean(axis=0) for m in _run_texts([" " + w for w in words_a + words_b])])
        d, mid, pooled = _contrast(vecs[: len(words_a)], vecs[len(words_a):])
        circuit = Circuit(
            f"{words_a[0]}… vs {words_b[0]}…", words_a[0] + "-like", words_b[0] + "-like",
            True, d, mid, pooled,
        )

    evidence, z, _ = circuit.read(entry["units"])
    units = []
    for i, uid in enumerate(circuit.uids):
        kind, layer, index = _unit_from_id(int(uid))
        units.append(
            {
                "kind": kind,
                "layer": layer,
                "index": index,
                "d": round(float(circuit.d[i]), 2),
                "side": circuit.side_a if circuit.d[i] >= 0 else circuit.side_b,
                "evidence": _r(evidence[:, i], 2),
            }
        )

    return {
        "name": circuit.name,
        "side_a": circuit.side_a,
        "side_b": circuit.side_b,
        "binary": circuit.binary,
        "detect_z": DETECT_Z,
        "heads": [u for u in units if u["kind"] == "head"],
        "neurons": [u for u in units if u["kind"] == "neuron"],
        "token_scores": _r(z, 2),
    }


@app.get("/api/model-info")
def model_info():
    return {
        "model_name": MODEL_NAME,
        "num_layers": NUM_LAYERS,
        "num_heads": NUM_HEADS,
        "mlp_dim": MLP_DIM,
        "max_tokens": MAX_TOKENS,
        "concepts": [
            {
                "key": k,
                "name": CONCEPTS[k]["name"],
                "side_a": CONCEPTS[k]["side_a"],
                "side_b": CONCEPTS[k]["side_b"],
                "binary": CONCEPT_BINARY[k],
                "examples": CONCEPTS[k]["a"][:4],
            }
            for k in CONCEPT_KEYS
        ],
    }


_frontend_dir = Path(__file__).resolve().parent.parent / "frontend"
if _frontend_dir.is_dir():
    # Present in local/single-container dev; absent in the backend-only Docker
    # image, where nginx serves the frontend and proxies /api/* here instead.
    app.mount("/", StaticFiles(directory=str(_frontend_dir), html=True), name="frontend")
