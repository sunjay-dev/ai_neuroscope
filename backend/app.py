"""AI Neuroscope backend — thin assembly of the `neuroscope` package.

Loads a small GPT-2 model locally and dissects it with PyTorch hooks (see
neuroscope/model.py). At startup we run labeled probe sets (see
neuroscope/concepts.py) through the model and score every head and neuron by
how selectively it fires for a concept (gender, sentiment, sarcasm, royalty,
...). That is what lets the dashboard say "Layer 2 · Head 3 is firing because
of royalty" from real measurements.

Importing this module is cheap: the model load and the ~15 s concept probes
run in the FastAPI lifespan below, in the load-bearing order
model → probes → circuits, each step storing its results on the shared
`state` object. No request (including the /api/model-info healthcheck) is
served until startup has completed.
"""

from contextlib import asynccontextmanager
from pathlib import Path
import shutil
import subprocess
from time import perf_counter

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .neuroscope import circuits, model, probing
from .neuroscope.api import router
from .neuroscope.config import MODEL_NAME, state
from .neuroscope.concepts import CONCEPTS


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Startup: load the model, run the probes, build the circuits — then serve."""
    model.load()
    print(f"[neuroscope] loaded {MODEL_NAME}; building concept probes…", flush=True)
    t0 = perf_counter()
    # ~15 s of forward passes the first time; afterwards the disk cache makes
    # this a load of numpy arrays (see neuroscope/probing.py).
    state.calibration, cache_hit = probing.get_calibration(model._run_texts)
    circuits.build_circuits(state.calibration)
    secs = perf_counter() - t0
    how = "calibration cache" if cache_hit else f"{len(state.calibration.pool_texts)} probe texts"
    print(f"[neuroscope] probed {how} in {secs:.1f}s across {len(CONCEPTS)} concepts; ready.", flush=True)
    yield


app = FastAPI(title="AI Neuroscope", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

# Register the API router *before* the catch-all "/" static mount below:
# Starlette matches routes in registration order.
app.include_router(router)


class SPAStaticFiles(StaticFiles):
    """StaticFiles mount with SPA routing fallback to index.html for non-API routes."""

    async def get_response(self, path: str, scope):
        request_path = scope.get("path", "")
        if request_path.startswith("/api"):
            return await super().get_response(path, scope)
        try:
            response = await super().get_response(path, scope)
        except Exception:
            response = await super().get_response("index.html", scope)
        if response.status_code == 404:
            response = await super().get_response("index.html", scope)
        return response


# NOTE: this path only resolves to <repo>/frontend while this file sits
# directly in backend/ (backend/app.py → .parent.parent == repo root). If this
# line ever moves into neuroscope/api.py, `.parent.parent` would silently
# become backend/, the mount would point at a nonexistent backend/frontend
# directory, and it would fail at startup (not import) — re-anchor on an
# explicit repo-root path if it moves.
_repo_dir = Path(__file__).resolve().parent.parent
_frontend_dir = _repo_dir / "frontend"
_dist_dir = _frontend_dir / "dist"

# In case dist is copied directly to /app/dist or repo root dist:
if not _dist_dir.is_dir() and (_repo_dir / "dist").is_dir():
    _dist_dir = _repo_dir / "dist"

# If dist does not exist yet in local development, build it if npm is available:
if not (_dist_dir.is_dir() and (_dist_dir / "index.html").is_file()) and _frontend_dir.is_dir():
    try:
        if shutil.which("npm"):
            print("[neuroscope] building frontend for backend server…", flush=True)
            subprocess.run(["npm", "run", "build"], cwd=str(_frontend_dir), check=True, capture_output=True)
    except Exception as exc:
        print(f"[neuroscope] could not build frontend: {exc}", flush=True)

if _dist_dir.is_dir() and (_dist_dir / "index.html").is_file():
    app.mount("/", SPAStaticFiles(directory=str(_dist_dir), html=True), name="frontend")
elif _frontend_dir.is_dir():
    app.mount("/", SPAStaticFiles(directory=str(_frontend_dir), html=True), name="frontend")
