"""Regression tests for the docker-compose wiring that make targets rely on.

No yaml dependency: these are plain-text assertions about the compose file,
because the failure mode they guard (a variable the Makefile sets never
reaching the container) is invisible to both the test suite and the running
app — `make rebuild-cache` just silently does nothing.
"""

from pathlib import Path

COMPOSE = Path(__file__).resolve().parent.parent / "docker-compose.yml"


def test_compose_file_exists():
    assert COMPOSE.is_file()


def test_backend_forwards_rebuild_cache_flag():
    # make rebuild-cache runs `NEUROSCOPE_REBUILD_CACHE=1 docker compose up`.
    # Compose only forwards variables a service explicitly declares, so the
    # backend service must list it — with a default, so normal boots are
    # unaffected.
    text = COMPOSE.read_text()
    assert "NEUROSCOPE_REBUILD_CACHE" in text, (
        "backend service must declare NEUROSCOPE_REBUILD_CACHE, "
        "otherwise `make rebuild-cache` never reaches the container"
    )
    assert "${NEUROSCOPE_REBUILD_CACHE:-0}" in text, "must default to 0 for normal boots"


def test_backend_still_forwards_model_choice():
    text = COMPOSE.read_text()
    assert "${NEUROSCOPE_MODEL:-gpt2}" in text


def test_frontend_publishes_3000():
    assert '"3000:80"' in COMPOSE.read_text()
