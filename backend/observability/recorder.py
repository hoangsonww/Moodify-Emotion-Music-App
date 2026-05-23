"""In-process metrics recorder for the Django backend.

Counterpart to ``modal_inference/metrics.py`` -- same shape, same
contract, so dashboards can render both feeds uniformly. Kept separate
from the Modal module because the two services have independent
lifecycles and don't share code at runtime.

Thread safety: Django runs each request in a thread (gunicorn /
WSGI), so concurrent ``record()`` calls are normal. All mutation is
gated by ``self._lock``.
"""

from __future__ import annotations

import os
import socket
import threading
import time
from collections import defaultdict, deque
from statistics import mean


_LATENCY_RESERVOIR_SIZE = 1000


def _percentile(samples: list[float], q: float) -> float:
    """Linear-interpolated percentile (q in [0, 100]); 0.0 on empty."""
    if not samples:
        return 0.0
    if len(samples) == 1:
        return float(samples[0])
    s = sorted(samples)
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
    """Short id for the current Vercel function / local dev server."""
    return (
        os.getenv("VERCEL_DEPLOYMENT_ID")
        or os.getenv("VERCEL_REGION", "")
        or f"{socket.gethostname()}-{os.getpid()}"
    )


class MetricsRecorder:
    """Thread-safe counters + ring-buffer reservoir."""

    def __init__(self, container_id: str | None = None) -> None:
        self._lock = threading.Lock()
        self._started_monotonic = time.monotonic()
        self._started_wall = time.time()
        self._container_id = container_id or _make_container_id()

        self._counters: dict[str, dict[str, int]] = defaultdict(
            lambda: {"total": 0, "errors": 0,
                     "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0, "other": 0}
        )
        self._latencies: dict[str, deque] = defaultdict(
            lambda: deque(maxlen=_LATENCY_RESERVOIR_SIZE)
        )
        self._status_codes: dict[str, dict[int, int]] = defaultdict(lambda: defaultdict(int))

    def record(self, endpoint: str, method: str, status: int, latency_ms: float) -> None:
        """Record one request. NEVER raises."""
        try:
            key = f"{method} {endpoint}"
            cls = _status_class(status)
            with self._lock:
                bucket = self._counters[key]
                bucket["total"] += 1
                bucket[cls] = bucket.get(cls, 0) + 1
                if cls in ("5xx", "4xx"):
                    bucket["errors"] += 1
                self._latencies[key].append(float(latency_ms))
                self._status_codes[key][int(status)] += 1
        except Exception:  # noqa: BLE001
            pass

    @property
    def container_id(self) -> str:
        return self._container_id

    @property
    def uptime_seconds(self) -> float:
        return time.monotonic() - self._started_monotonic

    @property
    def started_at(self) -> float:
        return self._started_wall

    def snapshot(self) -> dict:
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
        with self._lock:
            self._counters.clear()
            self._latencies.clear()
            self._status_codes.clear()
            self._started_monotonic = time.monotonic()
            self._started_wall = time.time()


_recorder = MetricsRecorder()


def get_recorder() -> MetricsRecorder:
    return _recorder


def reset_recorder() -> None:
    _recorder.reset()
