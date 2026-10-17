"""Startup probe: label-free reference statistics for every head and neuron.

Runs labeled probe sets (see concepts.py) plus an ordinary-text calibration
corpus through the model and summarises the activations. All the model
interaction goes through a `run_texts` callable (see model._run_texts), so a
test can pass a fake runner and build a Calibration without any weights.

Produces the `Calibration` object consumed by circuits.build_circuits() and
the API; nothing here runs at import time.
"""

from dataclasses import dataclass
from typing import Callable, Dict, List, Tuple

import numpy as np

from .config import state
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


def build_calibration(run_texts: Callable[[List[str]], List[np.ndarray]]) -> Calibration:
    """Run every probe + calibration text through the model and summarise it.

    Requires model.load() to have run first (reads state.dims for the
    head/neuron split of the unit vectors); the app's lifespan calls them in
    that order.
    """
    num_head_units = state.dims.num_head_units

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
