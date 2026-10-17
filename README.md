# The AI Neuroscope

Live neuron & attention-head circuit explorer for GPT-2. Type a sentence, watch it run
through the model, and pinpoint exactly which attention heads and MLP neurons fire for
specific words or concepts.

## Run it

### Option A: plain Python (one process, fastest for local dev)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.app:app --reload --port 8420
```

Open http://127.0.0.1:8420 — the backend serves the frontend directly, no separate
build step.

### Option B: Docker Compose (separate frontend/backend containers)

```bash
docker compose up --build
```

Open http://127.0.0.1:8420. This runs two containers:
- `backend` — FastAPI + GPT-2, API only, on an internal port (also published on 8000
  for direct API testing).
- `frontend` — nginx serving the static dashboard and reverse-proxying `/api/*` to
  `backend`, so the browser only ever talks to one origin.

Model weights are cached in a named Docker volume (`hf-cache`), so restarting the
containers doesn't re-download them. To use a different model, set `NEUROSCOPE_MODEL`
in your shell before `docker compose up` (see below).

The first run downloads GPT-2's weights (~500MB) from Hugging Face. On startup the
backend spends ~15s running the concept probes before it starts serving.

## How it works

**Backend** (`backend/app.py`, `backend/neuroscope/`) — GPT-2 small via Hugging Face
Transformers, dissected with PyTorch hooks:

- **Attention heads**: a forward pre-hook on each layer's `attn.c_proj` splits the
  output projection per head, giving each head's own write into the residual stream.
  Its norm is how hard that head *fires* on each token (12 layers × 12 heads).
- **MLP neurons**: a forward hook on each `mlp.act` captures all 3072 neurons/layer.
- **Attention patterns**: `output_attentions=True` gives where each head *looks*.
- Activations are reported as **σ above typical** (z-scored against a calibration
  corpus), so "firing intensely" is comparable across layers.
- **Concept probes**: at startup, labeled word/sentence sets (gender, sentiment,
  sarcasm, royalty, profession, place, time, animals, numbers) run through the model.
  Every head and neuron gets a Cohen's d per concept. The most selective units form
  each concept's **circuit**, read out per token as a vote z-scored against ordinary
  text (≥ 1.6σ = detected). That is how "king" → Royalty → *Layer 2 · Head 7* comes
  from real measurements, not a lookup table.

**Frontend** (`frontend/`) — vanilla JS, three panels:

1. **Input** — type (live mode re-analyzes as you type) or pick an example; the
   **Concept Circuit Finder** lights up a concept's heads + neurons across the
   sentence, and a custom probe accepts your own `A words vs B words`.
2. **Model Processing (Live)** — the neural web: rows = tokens, columns = layers.
   Each node is the most active head (or MLP neuron, via the toggle). Wires are the
   real attention weights flowing into the selected token. A layer-by-layer cascade
   plays on every run. **Hover a word** to pinpoint the node that explains it.
3. **Neuron Details** — why the node was picked, its activation, sibling heads,
   top influencing tokens (attention), its possible concept + effect sizes, probe
   words that fire it most, the concept read-out for the token, the model's
   next-word guess, and (for neurons) which next tokens it pushes toward.

API: `POST /api/analyze`, `GET /api/unit/{id}?kind=head|neuron&layer=&index=`,
`POST /api/concept`, `GET /api/model-info`.

Note: a start-of-text token is prepended to every input. It absorbs GPT-2's
well-known "attention sink" outlier activations, so they don't drown out your first word.

## Swapping the model

Set `NEUROSCOPE_MODEL` to any causal LM with the same GPT-2 architecture (e.g.
`distilgpt2`, `gpt2-medium`) before starting uvicorn, or before `docker compose up`.
