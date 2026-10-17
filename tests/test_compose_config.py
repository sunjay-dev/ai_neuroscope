"""Regression tests for the docker-compose wiring that make targets rely on.

These parse the compose file and scope every assertion to the service it
configures: a plain-text grep would happily pass if `NEUROSCOPE_REBUILD_CACHE`
sat under the frontend, or if `3000:80` moved off the frontend entirely.

Why this file exists at all: the failure mode it guards (a variable the
Makefile sets never reaching the container) is invisible to both the test
suite and the running app — `make rebuild-cache` just silently does nothing.
That exact bug shipped once, caught only by reading `docker compose config`.
"""

from pathlib import Path

import yaml

COMPOSE = Path(__file__).resolve().parent.parent / "docker-compose.yml"


def _services() -> dict:
    doc = yaml.safe_load(COMPOSE.read_text())
    assert isinstance(doc, dict) and "services" in doc, "not a compose file"
    return doc["services"]


def _env(service: str) -> dict:
    """The service's environment as a dict, regardless of list/dict form."""
    raw = _services()[service].get("environment", {})
    if isinstance(raw, list):
        raw = dict(item.split("=", 1) for item in raw)
    return raw


def test_backend_exists():
    assert "backend" in _services()


def test_backend_forwards_rebuild_cache_flag():
    # make rebuild-cache runs `NEUROSCOPE_REBUILD_CACHE=1 docker compose up`.
    # Compose only forwards variables a service explicitly declares, so the
    # backend service must list it — with a default, so normal boots are
    # unaffected.
    assert "NEUROSCOPE_REBUILD_CACHE" in _env("backend"), (
        "backend service must declare NEUROSCOPE_REBUILD_CACHE, "
        "otherwise `make rebuild-cache` never reaches the container"
    )
    assert _env("backend")["NEUROSCOPE_REBUILD_CACHE"] == "${NEUROSCOPE_REBUILD_CACHE:-0}"


def test_rebuild_cache_is_not_declared_on_frontend():
    # it must be *the backend* that re-probes; a misplaced declaration would
    # make the target look configured while leaving the real service untouched
    assert "NEUROSCOPE_REBUILD_CACHE" not in _env("frontend")


def test_backend_still_forwards_model_choice():
    assert _env("backend").get("NEUROSCOPE_MODEL") == "${NEUROSCOPE_MODEL:-gpt2}"


def _port_strings(service: str) -> list:
    """Each port entry as a string, for either the short or long YAML form."""
    ports = _services()[service].get("ports", [])
    return [str(p.get("published", "")) + ":" + str(p.get("target", ""))
            if isinstance(p, dict) else str(p) for p in ports]


def test_frontend_publishes_3000():
    ports = _port_strings("frontend")
    assert any(p.startswith("3000:80") for p in ports), ports


def test_frontend_not_publishing_old_port():
    # the dashboard moved 8420 -> 3000; make sure nothing still exposes it
    ports = " ".join(_port_strings("frontend"))
    assert "8420" not in ports, ports


def test_backend_healthcheck_still_targets_model_info():
    # the backend healthcheck is what makes `depends_on: condition:
    # service_healthy` work for the frontend; it must probe a real endpoint.
    test = _services()["backend"].get("healthcheck", {}).get("test", [])
    assert any("api/model-info" in str(part) for part in test), test
