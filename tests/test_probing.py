"""Tests for neuroscope/probing.py — the probe statistics and the disk cache.

Uses a fake `run_texts` runner (deterministic per-text activation matrices), so
everything here runs in seconds with no model, no torch, and no weights.
"""

import json

import numpy as np
import pytest

from backend.neuroscope import config, probing
from backend.neuroscope.config import Dims
from backend.neuroscope.concepts import CALIBRATION_SENTENCES, CONCEPTS

DIMS = Dims(num_layers=3, num_heads=3, d_model=24, mlp_dim=5)
UNITS = DIMS.num_head_units + DIMS.num_layers * DIMS.mlp_dim  # 24


def fake_run_texts(texts):
    """Deterministic (tokens, units) matrix per text — no model involved."""
    out = []
    for text in texts:
        seed = abs(hash(text)) % (2**32)
        rng = np.random.default_rng(seed)
        tokens = max(1, len(text.split()))
        out.append(rng.normal(1.0, 0.5, size=(tokens, UNITS)).astype(np.float32))
    return out


@pytest.fixture
def calib():
    return probing.build_calibration(fake_run_texts, DIMS)


# ------------------------------------------------------- build_calibration


def test_pool_shape_and_texts(calib):
    n_texts = len({probing._probe_text(c, x) for c in CONCEPTS.values() for x in c["a"] + c["b"]})
    assert calib.pool.shape == (n_texts, UNITS)
    assert len(calib.pool_texts) == n_texts


def test_calib_rows_are_calibration_tokens(calib):
    n_tokens = sum(max(1, len(s.split())) for s in CALIBRATION_SENTENCES)
    assert calib.calib.shape == (n_tokens, UNITS)


def test_reference_stats_shape_and_sd_floors(calib):
    assert calib.unit_mu.shape == (UNITS,)
    assert calib.unit_sd.shape == (UNITS,)
    # floors from probing.py: dead-ish units must not produce infinite z-scores
    heads, neurons = DIMS.num_head_units, UNITS
    assert np.all(calib.unit_sd[:heads] >= 0.05 * calib.unit_mu[:heads].mean())
    assert np.all(calib.unit_sd[heads:] >= 0.05)
    assert np.all(calib.unit_sd > 0)


def test_pool_word_idx_selects_single_word_probes_only(calib):
    # " king" -> one word (probe word); sarcasm's sentences -> many (excluded)
    words = [calib.pool_texts[i].strip() for i in calib.pool_word_idx]
    assert all(len(w.split()) == 1 for w in words)
    assert "king" in words
    assert not any("meeting" in w for w in words)


def test_concept_sides_cover_every_concept(calib):
    assert set(calib.concept_sides) == set(CONCEPTS)
    for key, (a_idx, b_idx) in calib.concept_sides.items():
        assert len(a_idx) == len(CONCEPTS[key]["a"]), key
        assert len(b_idx) == len(CONCEPTS[key]["b"]), key
        assert not set(a_idx) & set(b_idx), f"{key}: sides overlap"


# ------------------------------------------------------------- disk cache


@pytest.fixture
def isolated_cache(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "CACHE_DIR", tmp_path)
    monkeypatch.setattr(config, "REBUILD_CACHE", False)
    return tmp_path


def test_cache_round_trip(calib, isolated_cache):
    assert probing.save_calibration(calib, DIMS) is True
    assert len(list(isolated_cache.iterdir())) == 2  # npz + meta.json

    loaded = probing.load_cached_calibration(DIMS)
    assert loaded is not None
    np.testing.assert_allclose(loaded.pool, calib.pool)
    np.testing.assert_allclose(loaded.calib, calib.calib)
    np.testing.assert_allclose(loaded.unit_mu, calib.unit_mu)
    np.testing.assert_allclose(loaded.unit_sd, calib.unit_sd)
    np.testing.assert_array_equal(loaded.pool_word_idx, calib.pool_word_idx)
    assert loaded.pool_texts == calib.pool_texts
    assert {k: (list(a), list(b)) for k, (a, b) in loaded.concept_sides.items()} == {
        k: (list(a), list(b)) for k, (a, b) in calib.concept_sides.items()
    }


def test_get_calibration_miss_then_hit_never_reprobes(isolated_cache):
    calls = []

    def counting_runner(texts):
        calls.append(len(texts))
        return fake_run_texts(texts)

    cal, hit = probing.get_calibration(counting_runner, DIMS)
    # a miss probes exactly twice: once for the concept probe pool, once for
    # the ordinary-text calibration corpus
    assert hit is False
    assert len(calls) == 2

    def must_not_run(texts):
        raise AssertionError("cache hit must not re-run the probes")

    cal2, hit2 = probing.get_calibration(must_not_run, DIMS)
    assert hit2 is True
    np.testing.assert_allclose(cal2.unit_mu, cal.unit_mu)


def test_save_creates_missing_cache_dirs(calib, tmp_path, monkeypatch):
    monkeypatch.setattr(config, "CACHE_DIR", tmp_path / "missing" / "nested")  # ok, mkdir
    assert probing.save_calibration(calib, DIMS) is True
    assert probing.load_cached_calibration(DIMS) is not None


def test_model_change_invalidates_cache(calib, isolated_cache, monkeypatch):
    probing.save_calibration(calib, DIMS)
    monkeypatch.setattr(config, "MODEL_NAME", "distilgpt2")
    assert probing.load_cached_calibration(DIMS) is None


def test_rebuild_flag_bypasses_cache(calib, isolated_cache, monkeypatch):
    probing.save_calibration(calib, DIMS)
    monkeypatch.setattr(config, "REBUILD_CACHE", True)
    assert probing.load_cached_calibration(DIMS) is None


def test_dims_mismatch_invalidates_cache(calib, isolated_cache):
    # A cache from a different architecture must not be loaded even if the key
    # somehow matched. Deliberately uses a layout with the SAME total unit
    # count (4Lx2H + 4 neurons = 8+16 = 24, vs this suite's 3Lx3H + 5 neurons
    # = 9+15 = 24): only the recorded head/neuron split can tell them apart,
    # so a total-only check would wrongly accept it.
    probing.save_calibration(calib, DIMS)
    other = Dims(num_layers=4, num_heads=2, d_model=24, mlp_dim=4)
    total = lambda d: d.num_head_units + d.num_layers * d.mlp_dim
    assert total(other) == total(DIMS)
    assert other.num_head_units != DIMS.num_head_units
    assert probing.load_cached_calibration(other) is None


def test_missing_dims_metadata_is_a_miss(calib, isolated_cache):
    # caches written before the layout field existed must miss, not KeyError
    probing.save_calibration(calib, DIMS)
    _, meta_path = probing._cache_paths()
    meta = json.loads(meta_path.read_text())
    meta.pop("dims")
    meta_path.write_text(json.dumps(meta))
    assert probing.load_cached_calibration(DIMS) is None


def test_truncated_cache_is_treated_as_absent(calib, isolated_cache):
    probing.save_calibration(calib, DIMS)
    npz_path, _ = probing._cache_paths()
    npz_path.write_bytes(b"not a real npz")  # simulate a corrupt/partial write
    assert probing.load_cached_calibration(DIMS) is None


def test_unwritable_cache_dir_does_not_fail_startup(calib, tmp_path, monkeypatch):
    blocked = tmp_path / "blocked"
    blocked.write_text("")  # a file where the dir should be -> mkdir raises
    monkeypatch.setattr(config, "CACHE_DIR", blocked / "cache")
    assert probing.save_calibration(calib, DIMS) is False
    # and the calibration we built in-memory is still perfectly usable
    assert calib.pool.ndim == 2


# ------------------------------------------------- review regressions (PR #2)


def test_namespaced_model_id_still_caches(calib, isolated_cache, monkeypatch):
    # NEUROSCOPE_MODEL may be a repo id like "openai-community/gpt2". The raw
    # name used to land in the filename, so the path pointed into a nested
    # directory that save_calibration never created: save failed, and every
    # boot re-probed forever.
    monkeypatch.setattr(config, "MODEL_NAME", "openai-community/gpt2")
    assert probing.save_calibration(calib, DIMS) is True
    for path in isolated_cache.iterdir():
        assert "/" not in path.name, path
    loaded = probing.load_cached_calibration(DIMS)
    assert loaded is not None
    np.testing.assert_allclose(loaded.unit_mu, calib.unit_mu)


def test_distinct_model_ids_get_distinct_files(calib, isolated_cache, monkeypatch):
    # the filename is sanitized, but the digest still hashes the full model ID,
    # so two namespaced ids must never share a cache entry
    monkeypatch.setattr(config, "MODEL_NAME", "openai-community/gpt2")
    key_a = probing._cache_key()
    monkeypatch.setattr(config, "MODEL_NAME", "other-community/gpt2")
    key_b = probing._cache_key()
    assert key_a != key_b


def _write_meta(isolated_cache, **overrides):
    """Rewrite only meta.json, leaving the npz untouched."""
    _, meta_path = probing._cache_paths()
    meta = json.loads(meta_path.read_text())
    meta.update(overrides)
    meta_path.write_text(json.dumps(meta))


def test_meta_missing_pool_texts_is_a_miss_not_a_crash(calib, isolated_cache):
    # A KeyError here escaped the miss handler and crashed startup outright.
    probing.save_calibration(calib, DIMS)
    _drop_meta_key(calib, isolated_cache, "pool_texts")
    assert probing.load_cached_calibration(DIMS) is None


def _drop_meta_key(calib, isolated_cache, key):
    _, meta_path = probing._cache_paths()
    meta = json.loads(meta_path.read_text())
    meta.pop(key, None)
    meta_path.write_text(json.dumps(meta))


def test_short_pool_texts_is_a_miss(calib, isolated_cache):
    # npz and meta.json are two separate atomic writes; a crash between them
    # can pair new arrays with old metadata. Cardinality must be cross-checked.
    probing.save_calibration(calib, DIMS)
    _write_meta(isolated_cache, pool_texts=["only one text"])
    assert probing.load_cached_calibration(DIMS) is None


def test_out_of_range_concept_index_is_a_miss(calib, isolated_cache):
    # Every concept key must stay present: the key-set check runs BEFORE the
    # index-bounds check, so dropping keys here would make this test pass
    # without ever reaching the bounds logic it claims to cover (verified by
    # deleting the bounds check and watching the old version still pass).
    probing.save_calibration(calib, DIMS)
    _, meta_path = probing._cache_paths()
    meta = json.loads(meta_path.read_text())
    side = meta["concept_sides"]["gender"]
    side[0][0] = 9999  # one index out of range, all keys otherwise intact
    meta_path.write_text(json.dumps(meta))
    assert probing.load_cached_calibration(DIMS) is None


def test_non_object_meta_is_a_miss(calib, isolated_cache):
    probing.save_calibration(calib, DIMS)
    _, meta_path = probing._cache_paths()
    meta_path.write_text('"just a string"')
    assert probing.load_cached_calibration(DIMS) is None
