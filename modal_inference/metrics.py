"""In-process metrics recorder for the inference service.

Two-job module:

  1. **Live counters** for the current container -- bumped on every
     request, exposed on ``/health`` and ``/metrics``. Cheap, always
     available, but lost when the container scales down or dies.
  2. **Snapshot builder** -- packages the in-memory state into the
     same shape an aggregated Mongo query returns, so the live view
     and the persistent view look identical to a dashboard consumer.

The corresponding *persistent* store lives in ``metrics_store.py`` --
this module deliberately knows nothing about Mongo so it stays
trivially unit-testable.

Thread safety: every mutation goes through ``self._lock``. FastAPI
runs request handlers in a threadpool, so concurrent ``record()``
calls are normal.
"""

from __future__ import annotations

import os
import socket
import threading
import time
from collections import defaultdict, deque
from statistics import mean
from typing import Iterable


# ---------------------------------------------------------------------------
# Latency reservoir
# ---------------------------------------------------------------------------
# We keep the last N samples per endpoint in a ring buffer (deque maxlen)
# and compute percentiles by sorting on demand. At N = 1000 a sort is
# microseconds, and percentile error is well under 1 % for a fresh window
# -- entirely fine for SRE-grade telemetry at our request volume.
_LATENCY_RESERVOIR_SIZE = 1000


def _percentile(samples: list[float], q: float) -> float:
    """Linear-interpolated percentile -- ``q`` in [0, 100]. Returns 0.0
    for an empty sample list so dashboards don't see ``None``."""
    if not samples:
        return 0.0
    if len(samples) == 1:
        return float(samples[0])
    s = sorted(samples)
    # Nearest-rank with linear interpolation between the two surrounding
    # samples; matches numpy.percentile's default behaviour.
    k = (q / 100.0) * (len(s) - 1)
    f = int(k)
    c = min(f + 1, len(s) - 1)
    if f == c:
        return float(s[f])
    return float(s[f] + (s[c] - s[f]) * (k - f))


def _status_class(status: int) -> str:
    if 200 <= status < 300:
        return "2xx"
    if 300 <= status < 400:
        return "3xx"
    if 400 <= status < 500:
        return "4xx"
    if 500 <= status < 600:
        return "5xx"
    return "other"


def _make_container_id() -> str:
    """Best-effort short id for the current container -- shows up in
    every persisted metric row so operators can spot a single bad
    container in a multi-replica fanout."""
    # Modal sets MODAL_TASK_ID; locally fall back to hostname + pid.
    return (
        os.getenv("MODAL_TASK_ID")
        or f"{socket.gethostname()}-{os.getpid()}"
    )


class MetricsRecorder:
    """Thread-safe in-process counters + latency reservoirs."""

    def __init__(self, container_id: str | None = None) -> None:
        self._lock = threading.Lock()
        self._started_monotonic = time.monotonic()
        self._started_wall = time.time()
        self._container_id = container_id or _make_container_id()

        # endpoint -> {"total": int, "errors": int, "2xx": int, ...}
        self._counters: dict[str, dict[str, int]] = defaultdict(
            lambda: {"total": 0, "errors": 0, "degraded": 0,
                     "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0, "other": 0}
        )
        # endpoint -> deque of recent latency_ms
        self._latencies: dict[str, deque] = defaultdict(
            lambda: deque(maxlen=_LATENCY_RESERVOIR_SIZE)
        )
        # endpoint -> {status_code: count}, fine-grained for /metrics
        self._status_codes: dict[str, dict[int, int]] = defaultdict(lambda: defaultdict(int))

    # --- public mutation -------------------------------------------------
    def record(
        self,
        endpoint: str,
        method: str,
        status: int,
        latency_ms: float,
        degraded: bool = False,
    ) -> None:
        """Record one request. NEVER raises -- a metrics bug must not
        sink the request it's measuring."""
        try:
            key = f"{method} {endpoint}"
            cls = _status_class(status)
            with self._lock:
                bucket = self._counters[key]
                bucket["total"] += 1
                bucket[cls] = bucket.get(cls, 0) + 1
                if cls in ("5xx", "4xx"):
                    bucket["errors"] += 1
                if degraded:
                    bucket["degraded"] += 1
                self._latencies[key].append(float(latency_ms))
                self._status_codes[key][int(status)] += 1
        except Exception:  # noqa: BLE001 -- defensive; never break the request
            pass

    # --- read-only views -------------------------------------------------
    @property
    def container_id(self) -> str:
        return self._container_id

    @property
    def uptime_seconds(self) -> float:
        return time.monotonic() - self._started_monotonic

    @property
    def started_at(self) -> float:
        """Unix wall-clock time the recorder was created."""
        return self._started_wall

    def snapshot(self) -> dict:
        """Return a JSON-serialisable view of the current state.

        Shape matches what ``metrics_store.aggregate_window`` returns
        (modulo the ``"live"`` section the route adds) so the dashboard
        can treat live + persisted data the same way.
        """
        with self._lock:
            endpoints: list[dict] = []
            for key, counters in sorted(self._counters.items()):
                samples = list(self._latencies[key])
                method, endpoint = key.split(" ", 1)
                status_codes = dict(self._status_codes[key])
                endpoints.append({
                    "endpoint": endpoint,
                    "method": method,
                    "count": counters["total"],
                    "error_count": counters["errors"],
                    "degraded_count": counters["degraded"],
                    "error_rate": (counters["errors"] / counters["total"])
                                  if counters["total"] else 0.0,
                    "latency_ms": {
                        "p50": round(_percentile(samples, 50), 2),
                        "p95": round(_percentile(samples, 95), 2),
                        "p99": round(_percentile(samples, 99), 2),
                        "max": round(max(samples), 2) if samples else 0.0,
                        "mean": round(mean(samples), 2) if samples else 0.0,
                        "samples": len(samples),
                    },
                    "status_codes": {str(k): v for k, v in sorted(status_codes.items())},
                    "status_classes": {
                        "2xx": counters.get("2xx", 0),
                        "3xx": counters.get("3xx", 0),
                        "4xx": counters.get("4xx", 0),
                        "5xx": counters.get("5xx", 0),
                    },
                })
        return {
            "container": self._container_id,
            "uptime_seconds": round(self.uptime_seconds, 2),
            "started_at": self._started_wall,
            "endpoints": endpoints,
        }

    def reset(self) -> None:
        """Drop every counter and reservoir. Used by tests."""
        with self._lock:
            self._counters.clear()
            self._latencies.clear()
            self._status_codes.clear()
            self._started_monotonic = time.monotonic()
            self._started_wall = time.time()


# Module-global recorder so the FastAPI middleware and the /metrics
# route share one set of counters per container.
_recorder = MetricsRecorder()


def get_recorder() -> MetricsRecorder:
    return _recorder


def reset_recorder() -> None:
    """Test helper -- restore the global recorder to a clean state."""
    _recorder.reset()
