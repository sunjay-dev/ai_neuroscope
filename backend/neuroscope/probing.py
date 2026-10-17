"""Startup probe: label-free reference statistics for every head and neuron.

Runs labeled probe sets (see concepts.py) plus an ordinary-text calibration
corpus through the model and summarises the activations. All the model
interaction goes through a `run_texts` callable (see model._run_texts), so a
test can pass a fake runner and build a Calibration without any weights.

`build_calibration()` is pure (arrays in, Calibration out). The probing takes
~15 s of forward passes, so `get_calibration()` caches the result to disk
keyed by model name + a hash of the probe data: restarts load the arrays
instead of re-probing. Nothing here runs at import time.
"""

import hashlib
import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Dict, List, Optional, Tuple

import numpy as np

from . import config
from .config import Dims, state
from .concepts import CALIBRATION_SENTENCES, CONCEPTS


@dataclass
class Calibration:
    """Reference arrays for z-scoring unit activations (units = heads ++ neurons).

    pool: (texts, units) — each probe text, summarised by its mean activation.
    calib: (tokens, units) — ordinary text, one row per token: the "typical
        activity" reference circuits are z-scored against.
    unit_mu / unit_sd: per-unit mean/std over all pool + calibration tokens.
    pool_texts / pool_word_idx: the probe texts, and the single-word ones
        (shown as "words that also fire this unit" in the details panel).
    concept_sides: concept key -> (side-A indices, side-B indices) into pool.
    """

    pool: np.ndarray
    calib: np.ndarray
    unit_mu: np.ndarray
    unit_sd: np.ndarray
    pool_texts: List[str]
    pool_word_idx: np.ndarray
    concept_sides: Dict[str, Tuple[List[int], List[int]]]


def _probe_text(concept: dict, item: str) -> str:
    """Format one probe text: words get a leading space, sentences don't."""
    return item if concept["kind"] == "sentence" else " " + item


def build_calibration(
    run_texts: Callable[[List[str]], List[np.ndarray]], dims: Dims = None
) -> Calibration:
    """Run every probe + calibration text through the model and summarise it.

    `dims` splits unit vectors into heads vs neurons; defaults to the loaded
    model's dims, but tests pass their own to avoid any weights.
    """
    dims = dims or state.dims
    num_head_units = dims.num_head_units

    pool_texts: List[str] = []
    pool_index: dict = {}

    def pool_add(text: str) -> int:
        """Intern a probe text; return its row index in the pool."""
        if text not in pool_index:
            pool_index[text] = len(pool_texts)
            pool_texts.append(text)
        return pool_index[text]

    concept_sides = {
        key: (
            [pool_add(_probe_text(c, x)) for x in c["a"]],
            [pool_add(_probe_text(c, x)) for x in c["b"]],
        )
        for key, c in CONCEPTS.items()
    }

    # Each probe text is summarised by the mean activation over its tokens.
    pool_mats = run_texts(pool_texts)
    pool = np.stack([m.mean(axis=0) for m in pool_mats])  # (texts, units)
    # Ordinary text, one row per token: the "typical activity" reference.
    calib = np.concatenate(run_texts(CALIBRATION_SENTENCES), axis=0)  # (tokens, units)

    all_tokens = np.concatenate(pool_mats + [calib], axis=0)
    unit_mu = all_tokens.mean(axis=0)
    sd = all_tokens.std(axis=0)
    # Floor tiny spreads (dead-ish neurons) so z-scores don't explode on noise.
    sd[:num_head_units] = np.maximum(sd[:num_head_units], 0.05 * unit_mu[:num_head_units].mean())
    sd[num_head_units:] = np.maximum(sd[num_head_units:], 0.05)

    # Words (not sentences) that can be shown as "words that also fire this unit".
    pool_word_idx = np.array(
        [i for i, t in enumerate(pool_texts) if len(t.split()) == 1], dtype=np.int64
    )

    return Calibration(
        pool=pool,
        calib=calib,
        unit_mu=unit_mu,
        unit_sd=sd,
        pool_texts=pool_texts,
        pool_word_idx=pool_word_idx,
        concept_sides=concept_sides,
    )


# ---------------------------------------------------------------- disk cache
# Bump when the on-disk layout or the statistics behind it change.
CACHE_VERSION = 1


def _cache_paths() -> Tuple[Path, Path]:
    """(arrays.npz, meta.json) for the current model + probe data."""
    key = _cache_key()
    return config.CACHE_DIR / f"{key}.npz", config.CACHE_DIR / f"{key}.meta.json"


def _cache_key() -> str:
    """Hash model name + probe data: editing concepts.py invalidates the cache.

    The digest covers the full model ID, so namespaced IDs like
    `openai-community/gpt2` stay distinct; the filename only carries a
    path-sanitized copy, because a raw `/` in MODEL_NAME would otherwise turn
    the cache path into a nested directory save_calibration() never creates.
    """
    payload = json.dumps(
        {"model": config.MODEL_NAME, "concepts": CONCEPTS, "calibration": CALIBRATION_SENTENCES},
        sort_keys=True,
    )
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]
    safe_model = re.sub(r"[^A-Za-z0-9._-]", "-", config.MODEL_NAME)
    return f"calibration-v{CACHE_VERSION}-{safe_model}-{digest}"


def load_cached_calibration(dims: Dims) -> Optional[Calibration]:
    """A previously probed Calibration, or None if missing/stale/malformed.

    Every check AND the reconstruction below run inside the try: a damaged
    cache (missing metadata keys, mismatched array/metadata sizes from a crash
    between the two atomic writes, wrong shapes) must degrade to a re-probe,
    never to a startup crash.
    """
    if config.REBUILD_CACHE:
        return None
    npz_path, meta_path = _cache_paths()
    if not (npz_path.is_file() and meta_path.is_file()):
        return None
    try:
        with np.load(npz_path, allow_pickle=False) as data:
            arrays = {k: data[k] for k in ("pool", "calib", "unit_mu", "unit_sd", "pool_word_idx")}
        meta = json.loads(meta_path.read_text())

        expected_units = dims.num_head_units + dims.num_layers * dims.mlp_dim
        if meta.get("cache_version") != CACHE_VERSION or meta.get("model") != config.MODEL_NAME:
            return None
        if any(arrays[k].shape[-1] != expected_units for k in ("pool", "calib", "unit_mu", "unit_sd")):
            return None
        if set(meta.get("concept_sides", {})) != set(CONCEPTS):
            return None

        pool_texts = meta["pool_texts"]
        concept_sides = {k: (list(v[0]), list(v[1])) for k, v in meta["concept_sides"].items()}
        pool_word_idx = arrays["pool_word_idx"]

        # npz and meta.json are replaced by two separate atomic writes, so a
        # crash between them can pair new arrays with old metadata. Cross-check
        # their shared cardinality rather than trusting either alone.
        n_pool = arrays["pool"].shape[0]
        if len(pool_texts) != n_pool:
            return None
        if len(pool_word_idx) and (pool_word_idx.min() < 0 or pool_word_idx.max() >= n_pool):
            return None
        for a_side, b_side in concept_sides.values():
            for idx in (*a_side, *b_side):
                if not 0 <= int(idx) < n_pool:
                    return None
    except Exception:  # unreadable/truncated/malformed cache — treat as absent
        return None

    return Calibration(
        pool=arrays["pool"],
        calib=arrays["calib"],
        unit_mu=arrays["unit_mu"],
        unit_sd=arrays["unit_sd"],
        pool_texts=pool_texts,
        pool_word_idx=pool_word_idx,
        concept_sides=concept_sides,
    )


def save_calibration(cal: Calibration) -> bool:
    """Persist a Calibration atomically (write to .tmp, then os.replace).

    Writes both files before either becomes visible, so a crash mid-save can't
    leave a matching .npz with a stale .meta.json. Returns False on a
    read-only/missing cache dir rather than failing startup — the probe result
    itself is still valid, it just won't be reused.
    """
    npz_path, meta_path = _cache_paths()
    tmp_npz, tmp_meta = npz_path.with_suffix(".npz.tmp"), meta_path.with_suffix(".json.tmp")
    try:
        config.CACHE_DIR.mkdir(parents=True, exist_ok=True)
        with open(tmp_npz, "wb") as fh:
            np.savez_compressed(
                fh,
                pool=cal.pool,
                calib=cal.calib,
                unit_mu=cal.unit_mu,
                unit_sd=cal.unit_sd,
                pool_word_idx=cal.pool_word_idx,
            )
        tmp_meta.write_text(
            json.dumps(
                {
                    "cache_version": CACHE_VERSION,
                    "model": config.MODEL_NAME,
                    "pool_texts": cal.pool_texts,
                    "concept_sides": {k: [list(a), list(b)] for k, (a, b) in cal.concept_sides.items()},
                }
            )
        )
        os.replace(tmp_npz, npz_path)
        os.replace(tmp_meta, meta_path)
        return True
    except OSError:
        for leftover in (tmp_npz, tmp_meta):
            try:
                leftover.unlink()
            except OSError:
                pass
        return False


def get_calibration(run_texts: Callable[[List[str]], List[np.ndarray]], dims: Dims = None):
    """The Calibration for this model, from disk cache or a fresh probe.

    Returns (calibration, cache_hit). `run_texts` is only called on a miss.
    """
    dims = dims or state.dims
    cached = load_cached_calibration(dims)
    if cached is not None:
        return cached, True
    cal = build_calibration(run_texts, dims)
    save_calibration(cal)
    return cal, False
