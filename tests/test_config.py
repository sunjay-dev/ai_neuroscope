"""Dims: the model-derived dimensions handed to pure helpers explicitly.

These replace the old import-time reads off `model.config`; every test here
runs without torch or weights.
"""

import pytest

from backend.neuroscope.config import Dims

# 3 layers x 3 heads, d_model 24 -> d_head 8; 5 MLP neurons per layer.
# Small enough to reason about by hand, big enough to hold CIRCUIT_HEADS=6
# heads and CIRCUIT_NEURONS=12 neurons (9 head units, 15 neurons).
DIMS = Dims(num_layers=3, num_heads=3, d_model=24, mlp_dim=5)


def test_d_head():
    assert DIMS.d_head == 8


def test_num_head_units():
    assert DIMS.num_head_units == 9


def test_total_units():
    # units = heads ++ neurons, in that order, per token row
    assert DIMS.num_head_units + DIMS.num_layers * DIMS.mlp_dim == 24


def test_dims_are_frozen():
    with pytest.raises(Exception):
        DIMS.num_layers = 4
