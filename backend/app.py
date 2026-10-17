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

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .neuroscope import circuits, model, probing
from .neuroscope.api import router
from .neuroscope.config import MODEL_NAME, state
from .neuroscope.concepts import CONCEPTS


@asynccontextmanager
async def lifespan(_app: FastAPI):
    model.load()
    print(f"[neuroscope] loaded {MODEL_NAME}; running concept probes…", flush=True)
    state.calibration = probing.build_calibration(model._run_texts)
    circuits.build_circuits(state.calibration)
    print(f"[neuroscope] probed {len(state.calibration.pool_texts)} texts across {len(CONCEPTS)} concepts; ready.", flush=True)
    yield


app = FastAPI(title="AI Neuroscope", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

# Register the API router *before* the catch-all "/" static mount below:
# Starlette matches routes in registration order.
app.include_router(router)

# NOTE: this path only resolves to <repo>/frontend while this file sits
# directly in backend/ (backend/app.py → .parent.parent == repo root). If this
# line ever moves into neuroscope/api.py, `.parent.parent` would silently
# become backend/, the mount would point at a nonexistent backend/frontend
# directory, and it would fail at startup (not import) — re-anchor on an
# explicit repo-root path if it moves.
_frontend_dir = Path(__file__).resolve().parent.parent / "frontend"
if _frontend_dir.is_dir():
    # Present in local/single-container dev; absent in the backend-only Docker
    # image, where nginx serves the frontend and proxies /api/* here instead.
    app.mount("/", StaticFiles(directory=str(_frontend_dir), html=True), name="frontend")
