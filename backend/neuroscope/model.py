"""Tokenizer + GPT-2 loading, PyTorch hooks, and forward passes.

The model is dissected with PyTorch hooks:

- a forward pre-hook on every attention block's output projection (c_proj)
  captures each head's individual contribution to the residual stream, so we
  can say how strongly *each attention head* fires for each token;
- a forward hook on every MLP activation function captures per-neuron firing
  values (3072 neurons/layer);
- output_attentions captures every head's attention pattern (where it looks).

Nothing runs at import time: `load()` (called by the app's lifespan) does the
weights download/restore and hook registration, and stores tokenizer, model,
and the derived `Dims` on the shared `state` object (see config.py).
"""

import threading
from typing import List

import numpy as np
import torch
from transformers import GPT2LMHeadModel, GPT2Tokenizer

from .config import BATCH_SIZE, MODEL_NAME, Dims, state

_model_lock = threading.Lock()
_head_norms: dict = {}  # layer -> (batch, seq, heads)
_mlp_acts: dict = {}  # layer -> (batch, seq, mlp_dim)


def load() -> None:
    """Load tokenizer + model, derive dims, register hooks; results land on `state`."""
    tokenizer = GPT2Tokenizer.from_pretrained(MODEL_NAME)
    model = GPT2LMHeadModel.from_pretrained(MODEL_NAME, attn_implementation="eager")
    model.eval()
    # Inference only; frozen params also keep request worker threads grad-free.
    model.requires_grad_(False)

    dims = Dims(
        num_layers=model.config.n_layer,
        num_heads=model.config.n_head,
        d_model=model.config.n_embd,
        mlp_dim=model.config.n_inner or 4 * model.config.n_embd,
    )

    state.tokenizer = tokenizer
    state.model = model
    state.dims = dims
    state.bos = tokenizer.bos_token_id

    for i, block in enumerate(model.transformer.h):
        block.attn.c_proj.register_forward_pre_hook(_make_head_hook(i, model, dims))
        block.mlp.act.register_forward_hook(_make_mlp_hook(i))


def _make_head_hook(layer_idx: int, model, dims: Dims):
    # c_proj is a Conv1D (out = x @ W + b) whose input is the concatenation of
    # all heads' outputs. Splitting W by head gives each head's own write into
    # the residual stream; its norm is how hard that head "fires".
    w = model.transformer.h[layer_idx].attn.c_proj.weight.view(
        dims.num_heads, dims.d_head, dims.d_model
    )

    def hook(_module, args):
        x = args[0]
        b, s, _ = x.shape
        z = x.view(b, s, dims.num_heads, dims.d_head)
        _head_norms[layer_idx] = torch.einsum("bshd,hdm->bshm", z, w).norm(dim=-1)

    return hook


def _make_mlp_hook(layer_idx: int):
    def hook(_module, _inp, out):
        _mlp_acts[layer_idx] = out.detach()

    return hook


def _encode(text: str) -> List[int]:
    # A leading BOS token absorbs GPT-2's "attention sink" outlier activations,
    # which would otherwise land on (and drown out) the user's first word.
    return [state.bos] + state.tokenizer.encode(text)


def _forward(id_lists: List[List[int]], want_attn: bool = False):
    """Run a right-padded batch. Returns (model output, heads (B,L,S,H), mlp (B,L,S,D))."""
    max_len = max(len(x) for x in id_lists)
    ids = torch.full((len(id_lists), max_len), state.bos, dtype=torch.long)
    mask = torch.zeros_like(ids)
    for i, seq in enumerate(id_lists):
        ids[i, : len(seq)] = torch.tensor(seq)
        mask[i, : len(seq)] = 1
    with _model_lock:
        _head_norms.clear()
        _mlp_acts.clear()
        with torch.no_grad():
            out = state.model(input_ids=ids, attention_mask=mask, output_attentions=want_attn)
        heads = torch.stack([_head_norms[l] for l in range(state.dims.num_layers)], dim=1)
        mlp = torch.stack([_mlp_acts[l] for l in range(state.dims.num_layers)], dim=1)
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


def promoted_tokens(layer: int, index: int, k: int = 8) -> List[str]:
    """Direct logit effect: which next tokens this neuron's output vector pushes up."""
    w_out = state.model.transformer.h[layer].mlp.c_proj.weight[index]  # (d_model,)
    logits = (w_out * state.model.transformer.ln_f.weight) @ state.model.transformer.wte.weight.T
    return [state.tokenizer.decode([int(i)]) for i in logits.topk(k).indices]
