"""Pure-logic tests for neuroscope/circuits.py — numpy only, no torch, no weights.

The tiny Dims (3L x 3H, mlp_dim 5) gives 9 head units + 15 neurons = 24 units,
small enough for hand-computed expectations but large enough to hold a full
circuit (6 heads + 12 neurons are selected per concept).
"""

import numpy as np
import pytest

from backend.neuroscope.config import CIRCUIT_HEADS, CIRCUIT_NEURONS, LABEL_MIN_D, Dims
from backend.neuroscope.circuits import (
    CONCEPT_BINARY,
    CONCEPT_KEYS,
    Circuit,
    _best_label,
    _contrast,
    _selectivity,
    _unit_from_id,
    _unit_id,
)
from backend.neuroscope.concepts import CONCEPTS

DIMS = Dims(num_layers=3, num_heads=3, d_model=24, mlp_dim=5)
UNITS = DIMS.num_head_units + DIMS.num_layers * DIMS.mlp_dim  # 24


# ------------------------------------------------------------------ unit ids


@pytest.mark.parametrize(
    "kind,layer,index",
    [("head", 0, 0), ("head", 2, 2), ("neuron", 0, 0), ("neuron", 2, 4)],
)
def test_unit_id_round_trip(kind, layer, index):
    assert _unit_from_id(_unit_id(kind, layer, index, DIMS), DIMS) == (kind, layer, index)


def test_heads_occupy_the_low_ids():
    # heads must live in [0, num_head_units), neurons after — the (tokens, units)
    # matrix layout and every z-score slice depends on this ordering.
    assert _unit_id("head", 2, 2, DIMS) == 8 == DIMS.num_head_units - 1
    assert _unit_id("neuron", 0, 0, DIMS) == DIMS.num_head_units
    assert _unit_id("neuron", 2, 4, DIMS) == DIMS.num_head_units + 14 == UNITS - 1


# ----------------------------------------------------------- selectivity math


def test_selectivity_binary_takes_magnitude():
    d = np.array([-3.0, 2.0, 0.5])
    np.testing.assert_allclose(_selectivity(d, binary=True), [3.0, 2.0, 0.5])


def test_selectivity_unary_ignores_negative_direction():
    # unary concepts (royalty vs ordinary nouns) only count when the unit
    # fires MORE for the concept side, never when it fires less.
    d = np.array([-3.0, 2.0, 0.5])
    np.testing.assert_allclose(_selectivity(d, binary=False), [0.0, 2.0, 0.5])


def test_contrast_matches_hand_computed_cohens_d():
    # a=[[2,0],[4,0]] vs b=[[0,2],[0,4]]: each group's population var is [1,0]
    # and [0,1]; means are [3,0] and [0,3].
    # pooled[0] = sqrt((1+0)/2 + (0.25*1)^2) = sqrt(0.5625) = 0.75
    # d[0] = (3-0)/0.75 = 4  (and -4 on the second unit, by symmetry)
    d, mid, pooled = _contrast(
        np.array([[2.0, 0.0], [4.0, 0.0]]),
        np.array([[0.0, 2.0], [0.0, 4.0]]),
        unit_sd=np.array([1.0, 1.0]),
    )
    np.testing.assert_allclose(d, [4.0, -4.0], rtol=1e-6)
    np.testing.assert_allclose(mid, [1.5, 1.5])
    np.testing.assert_allclose(pooled, [0.75, 0.75])


def test_contrast_pooled_stays_positive():
    # Zero-variance groups are normal here (identical probe words); the
    # unit_sd term keeps pooled > 0. Note _contrast does NOT protect against
    # unit_sd=0 itself — that floor is applied upstream in probing.build_calibration
    # (asserted in test_probing.test_reference_stats_shape_and_sd_floors).
    a = np.array([[1.0, 1.0], [1.0, 1.0]])
    d, _, pooled = _contrast(a, a.copy(), unit_sd=np.array([1.0, 0.2]))
    assert np.all(pooled > 0)
    assert np.all(np.isfinite(d))
    np.testing.assert_allclose(d, [0.0, 0.0])  # same group on both sides


# -------------------------------------------------------------------- Circuit


def _make_d():
    """Effect sizes with a known winner per unit: neuron ids prefer side A."""
    rng = np.random.default_rng(7)
    d = rng.normal(0, 0.1, size=UNITS)
    # strongest 6 heads and 15*? -> just make specific units dominate
    d[[8, 7, 6, 5, 4, 3]] = 5.0  # six heads
    d[DIMS.num_head_units + np.arange(12)] = 4.0  # twelve neurons
    return d


def _make_circuit(binary=True):
    d = _make_d()
    mid = np.zeros(UNITS)
    pooled = np.ones(UNITS)
    calib = np.zeros((10, UNITS))
    return Circuit("Test", "A-side", "B-side", binary, d, mid, pooled, DIMS, calib)


def test_circuit_selects_most_selective_units():
    c = _make_circuit()
    assert len(c.uids) == CIRCUIT_HEADS + CIRCUIT_NEURONS == 18
    heads = c.uids[c.is_head]
    neurons = c.uids[~c.is_head]
    # the six d=5.0 heads and twelve d=4.0 neurons must win their slots
    np.testing.assert_array_equal(np.sort(heads), [3, 4, 5, 6, 7, 8])
    np.testing.assert_array_equal(np.sort(neurons), DIMS.num_head_units + np.arange(12))


def test_circuit_toward_a_follows_sign_of_d():
    c = _make_circuit()
    assert np.all(c.toward_a == 1.0)  # every selected unit has d > 0
    d = _make_d()
    d[[0, 1, 2, 3, 4, 5]] = -5.0  # strongest heads now prefer side B
    c2 = Circuit("T", "A", "B", True, d, np.zeros(UNITS), np.ones(UNITS), DIMS, np.zeros((4, UNITS)))
    assert np.all(c2.toward_a[:CIRCUIT_HEADS] == -1.0)


def test_circuit_evidence_and_votes_shapes():
    c = _make_circuit()
    units = np.zeros((5, UNITS))
    evidence, votes = c.evaluate(units)
    assert evidence.shape == (5, 18)
    assert votes.shape == (5,)
    # zeros vs mid=0 -> zero evidence everywhere
    np.testing.assert_allclose(evidence, 0.0)
    np.testing.assert_allclose(votes, 0.0)


def test_evidence_is_clipped():
    c = _make_circuit()
    evidence, _ = c.evaluate(np.full((1, UNITS), 100.0))
    assert evidence.max() <= 6.0 and evidence.min() >= -6.0


def test_read_returns_witnesses_for_both_kinds():
    c = _make_circuit()
    evidence, z, witness = c.read(np.zeros((5, UNITS)))
    assert set(witness) == {"head", "neuron"}
    assert len(witness["head"]) == 5 and len(witness["neuron"]) == 5
    for kind, pairs in witness.items():
        for layer, index in pairs:
            assert 0 <= layer < DIMS.num_layers
            assert 0 <= index < (DIMS.num_heads if kind == "head" else DIMS.mlp_dim)


def test_reading_the_calibration_itself_is_standard_normal():
    # property: z-scoring the same corpus the baseline was built on gives
    # ~mean 0, ~std 1. Catches a broken base_mu/base_sd calculation.
    rng = np.random.default_rng(1)
    calib = rng.normal(3.0, 2.0, size=(2000, UNITS))
    c = Circuit("T", "A", "B", True, _make_d(), np.zeros(UNITS), np.ones(UNITS), DIMS, calib)
    _, z, _ = c.read(calib)
    assert abs(z.mean()) < 0.05
    assert abs(z.std() - 1.0) < 0.1


@pytest.mark.parametrize(
    "z,binary,expected",
    [
        (1.6, True, "A-side"),  # at the detection threshold
        (1.59, True, None),  # just below
        (-1.6, True, "B-side"),  # binary concepts detect on both sides
        (-3.0, True, "B-side"),
        (-3.0, False, None),  # unary concepts only detect on side A
        (3.0, False, "A-side"),
    ],
)
def test_side_for_thresholds(z, binary, expected):
    c = Circuit("T", "A-side", "B-side", binary, np.ones(UNITS), np.zeros(UNITS), np.ones(UNITS),
                DIMS, np.zeros((4, UNITS)))
    assert c.side_for(z) == expected


# --------------------------------------------------------------------- labels


def test_best_label_none_below_threshold():
    concept_score = np.zeros((len(CONCEPT_KEYS), UNITS))
    concept_score[0, 0] = LABEL_MIN_D - 0.1
    assert _best_label(0, concept_score, np.zeros_like(concept_score)) is None


def test_best_label_picks_strongest_and_reports_side():
    concept_score = np.zeros((len(CONCEPT_KEYS), UNITS))
    concept_d = np.zeros((len(CONCEPT_KEYS), UNITS))
    concept_score[2, 0] = 3.5
    concept_d[2, 0] = -3.5  # negative d -> the unit prefers side_b
    label = _best_label(0, concept_score, concept_d)
    assert label["key"] == CONCEPT_KEYS[2]
    assert label["side"] == CONCEPTS[CONCEPT_KEYS[2]]["side_b"]  # side tracks the sign of d
    assert label["d"] == -3.5


def test_concept_binary_flags():
    # Documents the `is not NEUTRAL_WORDS` identity check: one-sided concepts
    # (royalty, profession, place, time, animal, number) contrast against the
    # neutral baseline; gender/sentiment/sarcasm are two-sided. If this test
    # starts failing after a concepts.py edit, the identity check broke.
    assert CONCEPT_BINARY["gender"] is True
    assert CONCEPT_BINARY["sentiment"] is True
    assert CONCEPT_BINARY["sarcasm"] is True
    for unary in ("royalty", "profession", "place", "time", "animal", "number"):
        assert CONCEPT_BINARY[unary] is False, unary
