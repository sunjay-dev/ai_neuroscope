"""Pydantic schemas and the API routes (a FastAPI router, no app construction).

The app itself — CORS middleware, the startup lifespan, and the static
frontend mount — is assembled in backend/app.py. Everything reads its
model/calibration results off the shared `state` object (config.py), which
the lifespan fills before any request is served.
"""

import uuid
from typing import List, Optional

import numpy as np
import torch
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from . import model
from .circuits import (
    CONCEPT_BINARY,
    CONCEPT_KEYS,
    Circuit,
    _best_label,
    _concept_label,
    _contrast,
    _unit_from_id,
    _unit_id,
)
from .config import (
    DETECT_Z,
    MAX_CACHE,
    MAX_TOKENS,
    MODEL_NAME,
    TOP_NEURONS_PER_CELL,
    state,
)
from .concepts import CONCEPTS

router = APIRouter()


def _get_analysis(analysis_id: str) -> dict:
    entry = state.cache.get(analysis_id)
    if entry is None:
        raise HTTPException(404, "analysis not found (it may have expired) — re-run the analysis")
    return entry


def _r(arr, nd=3):
    return np.round(np.asarray(arr, dtype=np.float64), nd).tolist()


# --------------------------------------------------------------------- API


class AnalyzeRequest(BaseModel):
    text: str


@router.post("/api/analyze")
def analyze(req: AnalyzeRequest):
    text = req.text.strip()
    if not text:
        raise HTTPException(400, "text is required")

    dims = state.dims
    calib = state.calibration
    concept_d, concept_score = state.concept_d, state.concept_score

    all_ids = model._encode(text)
    ids = all_ids[: MAX_TOKENS + 1]
    if len(ids) < 2:
        raise HTTPException(400, "text produced no tokens")
    out, heads, mlp = model._forward([ids], want_attn=True)
    heads = heads[0, :, 1:, :]  # (L, S, H) — drop BOS position
    mlp = mlp[0, :, 1:, :]  # (L, S, D)
    seq = heads.shape[1]
    tokens = [state.tokenizer.decode([t]) for t in ids[1:]]
    units = model._unit_matrix(heads, mlp)
    z_all = (units - calib.unit_mu) / calib.unit_sd

    head_z = z_all[:, : dims.num_head_units].reshape(seq, dims.num_layers, dims.num_heads).transpose(1, 2, 0)

    mlp_z = torch.from_numpy(z_all[:, dims.num_head_units:].reshape(seq, dims.num_layers, dims.mlp_dim))
    top_z, top_idx = mlp_z.topk(TOP_NEURONS_PER_CELL, dim=-1)  # (S, L, k)
    neuron_top = [
        [
            [
                {
                    "neuron": (n := int(top_idx[t, l, k])),
                    "z": round(float(top_z[t, l, k]), 2),
                    "label": _best_label(_unit_id("neuron", l, n, dims), concept_score, concept_d),
                }
                for k in range(TOP_NEURONS_PER_CELL)
            ]
            for t in range(seq)
        ]
        for l in range(dims.num_layers)
    ]

    # Read every concept circuit over the sentence: which tokens carry which
    # concept, and which specific head / neuron is driving that reading.
    concepts = {}
    token_concepts = [[] for _ in range(seq)]
    for key, circuit in state.circuits.items():
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
        [{"token": state.tokenizer.decode([int(p_idx[t, k])]), "p": round(float(p_top[t, k]), 3)}
         for k in range(3)]
        for t in range(seq)
    ]

    analysis_id = uuid.uuid4().hex
    state.cache[analysis_id] = {"units": units, "tokens": tokens}
    while len(state.cache) > MAX_CACHE:
        state.cache.popitem(last=False)

    return {
        "analysis_id": analysis_id,
        "tokens": tokens,
        "num_layers": dims.num_layers,
        "num_heads": dims.num_heads,
        "mlp_dim": dims.mlp_dim,
        "head_z": _r(head_z, 2),
        "head_labels": state.head_labels,
        "attention": _r(attention, 3),
        "attention_sink": _r(sink, 3),
        "neuron_top": neuron_top,
        "concepts": concepts,
        "token_concepts": token_concepts,
        "predictions": predictions,
        "truncated": len(all_ids) > MAX_TOKENS + 1,
    }


@router.get("/api/unit/{analysis_id}")
def unit_detail(analysis_id: str, kind: str, layer: int, index: int):
    """Everything the details panel shows for one attention head or MLP neuron."""
    dims = state.dims
    calib = state.calibration
    if kind not in ("head", "neuron"):
        raise HTTPException(400, "kind must be 'head' or 'neuron'")
    if not (0 <= layer < dims.num_layers):
        raise HTTPException(400, "invalid layer")
    if not (0 <= index < (dims.num_heads if kind == "head" else dims.mlp_dim)):
        raise HTTPException(400, "invalid index")
    entry = _get_analysis(analysis_id)
    uid = _unit_id(kind, layer, index, dims)

    acts = entry["units"][:, uid]
    z = (acts - calib.unit_mu[uid]) / calib.unit_sd[uid]

    order = np.argsort(-state.concept_score[:, uid])[:3]
    concepts = [
        {**_concept_label(int(ci), uid, state.concept_d), "score": round(float(state.concept_score[ci, uid]), 2)}
        for ci in order
    ]

    pool_vals = calib.pool[calib.pool_word_idx, uid]
    best = np.argsort(-pool_vals)[:8]
    top_words = [
        {
            "word": calib.pool_texts[calib.pool_word_idx[i]].strip(),
            "z": round(float((pool_vals[i] - calib.unit_mu[uid]) / calib.unit_sd[uid]), 2),
        }
        for i in best
    ]

    promotes = None
    if kind == "neuron":
        # Direct logit effect: which next tokens this neuron's output vector pushes up.
        promotes = model.promoted_tokens(layer, index)

    return {
        "kind": kind,
        "layer": layer,
        "index": index,
        "label": _best_label(uid, state.concept_score, state.concept_d),
        "concepts": concepts,
        "all_concepts": {
            k: {**_concept_label(ci, uid, state.concept_d), "score": round(float(state.concept_score[ci, uid]), 2)}
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


@router.post("/api/concept")
def concept_circuit(req: ConceptRequest):
    """A concept's circuit (top heads + neurons) traced through the analyzed sentence."""
    entry = _get_analysis(req.analysis_id)

    if req.key:
        circuit = state.circuits.get(req.key)
        if circuit is None:
            raise HTTPException(404, f"unknown concept '{req.key}'")
    else:
        words_a = [w.strip() for w in (req.words_a or []) if w.strip()]
        words_b = [w.strip() for w in (req.words_b or []) if w.strip()]
        if len(words_a) < 2 or len(words_b) < 2:
            raise HTTPException(400, "give at least 2 words on each side")
        if len(words_a) + len(words_b) > 80:
            raise HTTPException(400, "too many words (max 80 total)")
        vecs = np.stack(
            [m.mean(axis=0) for m in model._run_texts([" " + w for w in words_a + words_b])]
        )
        d, mid, pooled = _contrast(vecs[: len(words_a)], vecs[len(words_a):], state.calibration.unit_sd)
        circuit = Circuit(
            f"{words_a[0]}… vs {words_b[0]}…", words_a[0] + "-like", words_b[0] + "-like",
            True, d, mid, pooled, state.dims, state.calibration.calib,
        )

    evidence, z, _ = circuit.read(entry["units"])
    units = []
    for i, uid in enumerate(circuit.uids):
        kind, layer, index = _unit_from_id(int(uid), state.dims)
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


@router.get("/api/model-info")
def model_info():
    return {
        "model_name": MODEL_NAME,
        "num_layers": state.dims.num_layers,
        "num_heads": state.dims.num_heads,
        "mlp_dim": state.dims.mlp_dim,
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
