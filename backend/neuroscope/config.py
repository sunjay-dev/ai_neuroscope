"""Configuration, shared constants, and the single app-state object.

This is the root of the package's import graph (config/concepts → model →
probing → circuits → api): it imports only the standard library, so every
other module — including the pure-logic ones a test imports without torch —
can depend on it freely.
"""

from __future__ import annotations

import os
from collections import OrderedDict
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING, Any, Optional

if TYPE_CHECKING:  # annotation only; probing imports config at runtime
    from .probing import Calibration

# ------------------------------------------------------------------ constants

MODEL_NAME = os.environ.get("NEUROSCOPE_MODEL", "gpt2")
MAX_TOKENS = 32
MAX_CACHE = 20
BATCH_SIZE = 32
TOP_NEURONS_PER_CELL = 3
CIRCUIT_HEADS = 6
CIRCUIT_NEURONS = 12
LABEL_MIN_D = 2.0  # effect size below this is reported as "no clear concept"
DETECT_Z = 1.6  # circuit reading this far above ordinary text = concept detected

# ------------------------------------------------------------------- caching
# The startup probes (~15 s of forward passes over ~278 texts) are cached to
# disk, keyed by model name + a hash of the probe data, so restarts skip
# straight to loading the arrays. Default location sits inside the HF cache
# volume mounted by docker-compose.yml (hf-cache -> /root/.cache/huggingface),
# so the cache survives container recreation. Override with NEUROSCOPE_CACHE_DIR;
# set NEUROSCOPE_REBUILD_CACHE=1 to force a re-probe.
CACHE_DIR = Path(
    os.environ.get(
        "NEUROSCOPE_CACHE_DIR",
        str(Path.home() / ".cache" / "huggingface" / "neuroscope"),
    )
)
REBUILD_CACHE = os.environ.get("NEUROSCOPE_REBUILD_CACHE", "").lower() in ("1", "true", "yes")


# ---------------------------------------------------------------------- state


@dataclass(frozen=True)
class Dims:
    """Model-derived dimensions, handed to pure helpers explicitly.

    These used to be read off `model.config` at import time; as a plain
    dataclass a test can construct them by hand and exercise unit-id math,
    circuits, etc. without loading any weights.
    """

    num_layers: int
    num_heads: int
    d_model: int
    mlp_dim: int

    @property
    def d_head(self) -> int:
        """Per-head width of the residual stream (d_model / num_heads)."""
        return self.d_model // self.num_heads

    @property
    def num_head_units(self) -> int:
        """Heads occupy the first slice of every (tokens, units) matrix."""
        return self.num_layers * self.num_heads


@dataclass
class AppState:
    """Everything the old import-time initialization produced, in one place.

    Filled by the app's lifespan, in this order:
    `model.load()` → `probing.build_calibration()` → `circuits.build_circuits()`.
    """

    # --- model.load()
    model: Any = None
    tokenizer: Any = None
    dims: Optional[Dims] = None
    bos: Optional[int] = None
    # --- probing.build_calibration()
    calibration: Optional["Calibration"] = None
    # --- circuits.build_circuits()
    circuits: dict = field(default_factory=dict)  # concept key -> Circuit
    concept_d: Any = None  # (concepts, units) Cohen's d per concept/unit
    concept_score: Any = None  # selectivity score behind the concept labels
    head_labels: Any = None  # per (layer, head) best concept label
    # --- API analysis cache (analysis_id -> {"units": ..., "tokens": ...})
    cache: "OrderedDict[str, dict]" = field(default_factory=OrderedDict)


state = AppState()
