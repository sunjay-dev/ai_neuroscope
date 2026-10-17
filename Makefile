# Convenience targets. Nothing here is required — docker compose works alone —
# but `make test` is the gate to run before committing backend changes.

COMPOSE ?= docker compose
# Bare interpreter for the test container, same tag as backend/Dockerfile.
PY_IMAGE := python:3.12-slim

.PHONY: up down restart ps logs test rebuild-cache

up:            ## build + start everything (dashboard on :3000)
	$(COMPOSE) up --build -d

down:          ## stop and remove containers (keeps the model/calibration volumes)
	$(COMPOSE) down

restart:
	$(COMPOSE) restart

ps:
	$(COMPOSE) ps -a

logs:
	$(COMPOSE) logs -f --tail=50

test:          ## run the test suite in a bare container: numpy+pytest only, no torch
	docker run --rm \
		-e PYTHONDONTWRITEBYTECODE=1 \
		-v "$(CURDIR)":/repo:ro \
		-w /repo $(PY_IMAGE) \
		sh -c "pip install -q -r requirements-dev.txt && python -m pytest -q -p no:cacheprovider"

rebuild-cache: ## force a fresh probe run, re-writing the calibration cache
	NEUROSCOPE_REBUILD_CACHE=1 $(COMPOSE) up -d --force-recreate backend
