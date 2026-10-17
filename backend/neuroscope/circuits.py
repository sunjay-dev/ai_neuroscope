"""Concept circuits: selectivity scoring, unit-id helpers, and labels.

Everything in here is pure numpy over explicit arguments — a `Dims` for the
model-derived dimensions, the calibration arrays handed to `Circuit` — so
importing this module needs neither a model nor torch, and every helper is
unit-testable without weights. The only thing touching shared state is
build_circuits(), which *writes* its results to `state` (config.py).
"""

from typing import TYPE_CHECKING, Optional

import numpy as np

from .config import (
    CIRCUIT_HEADS,
    CIRCUIT_NEURONS,
    DETECT_Z,
    LABEL_MIN_D,
    Dims,
    state,
)
from .concepts import CONCEPTS, NEUTRAL_WORDS

if TYPE_CHECKING:  # annotation only; probing is below us in the import graph
    from .probing import Calibration

CONCEPT_KEYS = list(CONCEPTS.keys())
CONCEPT_BINARY = {k: CONCEPTS[k]["b"] is not NEUTRAL_WORDS for k in CONCEPT_KEYS}


# ------------------------------------------------------------------ unit ids


def _unit_id(kind: str, layer: int, index: int, dims: Dims) -> int:
    """(kind, layer, index) -> flat unit id; heads occupy [0, num_head_units)."""
    if kind == "head":
        return layer * dims.num_heads + index
    return dims.num_head_units + layer * dims.mlp_dim + index


def _unit_from_id(uid: int, dims: Dims):
    """Inverse of _unit_id: flat unit id -> (kind, layer, index)."""
    if uid < dims.num_head_units:
        return "head", uid // dims.num_heads, uid % dims.num_heads
    uid -= dims.num_head_units
    return "neuron", uid // dims.mlp_dim, uid % dims.mlp_dim


# ----------------------------------------------------------- selectivity math


def _contrast(a: np.ndarray, b: np.ndarray, unit_sd: np.ndarray):
    """Cohen's d per unit between two groups of unit vectors."""
    mean_a, mean_b = a.mean(axis=0), b.mean(axis=0)
    pooled = np.sqrt((a.var(axis=0) + b.var(axis=0)) / 2 + (0.25 * unit_sd) ** 2)
    return (mean_a - mean_b) / pooled, (mean_a + mean_b) / 2, pooled


def _selectivity(d: np.ndarray, binary: bool) -> np.ndarray:
    """Turn Cohen's d into a nonnegative selectivity score."""
    # Binary concepts are meaningful in both directions (feminine vs masculine);
    # unary ones only count when the unit fires *more* for the concept.
    return np.abs(d) if binary else np.maximum(d, 0)


class Circuit:
    """A concept's most selective heads + neurons, read out as a linear vote."""

    def __init__(self, name, side_a, side_b, binary, d, mid, pooled, dims: Dims, calib: np.ndarray):
        """Pick the most selective heads + neurons and baseline the vote on `calib`."""
        # calib: (tokens, units) ordinary-text reference the vote is z-scored
        # against; dims splits the unit ids into heads vs neurons.
        self.name, self.side_a, self.side_b, self.binary = name, side_a, side_b, binary
        self.dims = dims
        score = _selectivity(d, binary)
        heads = np.argsort(-score[: dims.num_head_units])[:CIRCUIT_HEADS]
        neurons = np.argsort(-score[dims.num_head_units:])[:CIRCUIT_NEURONS] + dims.num_head_units
        self.uids = np.concatenate([heads, neurons])
        self.is_head = self.uids < dims.num_head_units
        self.d = d[self.uids]
        self.toward_a = np.where(self.d >= 0, 1.0, -1.0)
        self.mid = mid[self.uids]
        self.pooled = pooled[self.uids]
        _, votes = self.evaluate(calib)
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
            witness[kind] = [_unit_from_id(int(self.uids[i]), self.dims)[1:] for i in best]
        return evidence, z, witness

    def side_for(self, z: float) -> Optional[str]:
        """The concept side this z-score detects, or None below DETECT_Z."""
        if z >= DETECT_Z:
            return self.side_a
        if self.binary and z <= -DETECT_Z:
            return self.side_b
        return None


# ------------------------------------------------------------------- labels


def _concept_label(ci: int, uid: int, concept_d: np.ndarray) -> dict:
    """JSON label for one (concept, unit): chosen side + effect size d."""
    key = CONCEPT_KEYS[ci]
    c = CONCEPTS[key]
    d = float(concept_d[ci, uid])
    return {
        "key": key,
        "name": c["name"],
        "side": c["side_a"] if d >= 0 else c["side_b"],
        "d": round(d, 2),
    }


def _best_label(uid: int, concept_score: np.ndarray, concept_d: np.ndarray) -> Optional[dict]:
    """A unit's strongest concept label, or None below LABEL_MIN_D."""
    ci = int(concept_score[:, uid].argmax())
    if concept_score[ci, uid] < LABEL_MIN_D:
        return None
    return _concept_label(ci, uid, concept_d)


# --------------------------------------------------------------- the builder


def build_circuits(calib: "Calibration") -> None:
    """Contrast every concept over the probe pool and build its Circuit.

    Requires model.load() first (reads state.dims); the results are stored on
    `state` (circuits, concept_d, concept_score, head_labels).
    """
    dims = state.dims
    ds = []
    circuits = {}
    for key in CONCEPT_KEYS:
        c = CONCEPTS[key]
        a_idx, b_idx = calib.concept_sides[key]
        d, mid, pooled = _contrast(calib.pool[a_idx], calib.pool[b_idx], calib.unit_sd)
        ds.append(d)
        circuits[key] = Circuit(
            c["name"], c["side_a"], c["side_b"], CONCEPT_BINARY[key], d, mid, pooled, dims, calib.calib
        )
    concept_d = np.stack(ds).astype(np.float32)  # (concepts, units)
    concept_score = np.stack(
        [_selectivity(concept_d[i], CONCEPT_BINARY[k]) for i, k in enumerate(CONCEPT_KEYS)]
    )
    head_labels = [
        [_best_label(_unit_id("head", l, h, dims), concept_score, concept_d) for h in range(dims.num_heads)]
        for l in range(dims.num_layers)
    ]

    state.circuits = circuits
    state.concept_d = concept_d
    state.concept_score = concept_score
    state.head_labels = head_labels
