"""Django middleware that times every request and persists one metric row.

Symmetric with the FastAPI middleware in ``modal_inference/service.py``:

* Times the wall-clock duration from `__call__` entry to response exit.
* Normalises the endpoint to the URL pattern (``/users/<str:user_id>/...``)
  so high-cardinality path params don't blow up the time-series.
* Updates the in-process recorder for live ``/api/metrics/`` reads.
* Writes one row to the persistent Mongo store.
* Skips internal paths (``/swagger/``, ``/redoc/``, ``/favicon.ico``,
  ``/api/metrics/`` itself, ``/api/health/`` -- liveness probes would
  otherwise drown the time-series in noise).
* Catches every exception locally; metrics must never break a request.
"""

from __future__ import annotations

import logging
import time

from django.conf import settings

from . import recorder as recorder_module
from . import store as store_module

logger = logging.getLogger(__name__)


_SKIP_PREFIXES = (
    "/swagger",        # /swagger/, /swagger.json, /swagger.yaml
    "/redoc",
    "/favicon.ico",
    "/api/metrics",    # reading metrics shouldn't inflate metrics
    "/api/health",     # liveness probes, hit every 10-60s
)


def _normalise_endpoint(request) -> str:
    """Return the URL pattern (``/users/<str:user_id>/...``) so the
    persisted endpoint is the *template*, not the resolved path.

    Falls back to the raw path when no URL pattern matched (404, etc.).
    """
    match = getattr(request, "resolver_match", None)
    if match is not None:
        # Django stores the original route on the URLPattern via
        # ``route`` (string form like ``users/<str:user_id>/profile/``).
        route = getattr(match, "route", None)
        if route:
            return "/" + route.rstrip("/") + "/" if not route.startswith("/") else route
    return request.path or "/"


class MetricsMiddleware:
    """Old-style Django middleware: __init__(get_response), __call__(request)."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Fast-path: if metrics are disabled, do nothing.
        if not getattr(settings, "METRICS_ENABLED", True):
            return self.get_response(request)

        start = time.perf_counter()
        response = self.get_response(request)
        try:
            path = request.path or "/"
            if any(path.startswith(p) for p in _SKIP_PREFIXES):
                return response

            latency_ms = (time.perf_counter() - start) * 1000.0
            status = int(getattr(response, "status_code", 500))
            endpoint = _normalise_endpoint(request)
            method = request.method or "GET"

            recorder_module.get_recorder().record(
                endpoint=endpoint, method=method,
                status=status, latency_ms=latency_ms,
            )
            store_module.insert_event(
                endpoint=endpoint, method=method,
                status=status, latency_ms=latency_ms,
                container_id=recorder_module.get_recorder().container_id,
            )
        except Exception:  # noqa: BLE001
            # Metrics must never break the request.
            logger.warning("metrics middleware failed", exc_info=False)
        return response
