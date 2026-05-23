"""Persistent SRE metrics store for the Django backend.

Backs the ``backend_metrics`` time-series collection on the same Mongo
Atlas cluster the rest of the app uses. The mongoengine connection
itself is already opened in ``backend/settings.py``; we reach down to
the underlying ``pymongo`` client via mongoengine's
``get_connection()`` so we don't re-open a second socket pool.

Same contract as ``modal_inference/metrics_store.py``:

* Per-request synchronous write -- if the connection is warm, it's
  ~1 ms; if Atlas is misbehaving, the timeout caps it at the
  serverSelectionTimeout the connection was opened with.
* Failures swallowed silently. Metrics MUST NOT break the request.
* Native TTL prunes old samples; no cron required.
* Time-series collection is created lazily on first write.
"""

from __future__ import annotations

import logging
import threading
from datetime import datetime, timedelta, timezone
from statistics import mean
from typing import Optional

from django.conf import settings

logger = logging.getLogger(__name__)

SERVICE_NAME = "django"

_lock = threading.Lock()
_collection = None  # type: ignore[var-annotated]
_init_attempted = False


def _percentile(samples: list[float], q: float) -> float:
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


def _get_collection():
    """Return the time-series collection or None if disabled / unavailable.

    Reuses the mongoengine connection that ``backend/settings.py``
    already opened -- no second pool, no second auth round-trip.
    """
    global _collection, _init_attempted

    if not getattr(settings, "METRICS_ENABLED", True):
        return None
    if _collection is not None:
        return _collection
    if _init_attempted and _collection is None:
        return None

    with _lock:
        if _collection is not None:
            return _collection
        _init_attempted = True
        try:
            from mongoengine.connection import get_connection
            from pymongo.errors import CollectionInvalid, OperationFailure

            client = get_connection()
            db_name = getattr(settings, "MONGO_DB_NAME", None) or "emotion_based_music_db"
            db = client[db_name]
            coll_name = getattr(settings, "METRICS_COLLECTION", "backend_metrics")
            ttl_seconds = int(getattr(settings, "METRICS_TTL_DAYS", 30)) * 86400
            try:
                db.create_collection(
                    coll_name,
                    timeseries={
                        "timeField": "ts",
                        "metaField": "meta",
                        "granularity": "minutes",
                    },
                    expireAfterSeconds=ttl_seconds,
                )
                logger.info("Created backend metrics collection '%s'", coll_name)
            except (CollectionInvalid, OperationFailure):
                # Already exists -- carry on.
                pass

            _collection = db[coll_name]
            try:
                _collection.create_index(
                    [("meta.service", 1), ("meta.endpoint", 1), ("ts", -1)]
                )
            except Exception:  # noqa: BLE001
                pass
            return _collection
        except Exception:  # noqa: BLE001
            logger.exception(
                "Backend metrics store init failed -- continuing without persistence."
            )
            _collection = None
            return None


def insert_event(
    *,
    endpoint: str,
    method: str,
    status: int,
    latency_ms: float,
    container_id: str,
) -> None:
    """Insert one metric event. Never raises."""
    try:
        coll = _get_collection()
        if coll is None:
            return
        coll.insert_one({
            "ts": datetime.now(timezone.utc),
            "meta": {
                "service": SERVICE_NAME,
                "endpoint": endpoint,
                "method": method,
                "container": container_id,
                "status_class": _status_class(int(status)),
            },
            "status": int(status),
            "latency_ms": float(latency_ms),
        })
    except Exception:  # noqa: BLE001
        logger.warning("backend metrics insert failed (silently skipping)")


_WINDOW_SECONDS = {
    "5m": 300, "15m": 900, "1h": 3600, "6h": 21600,
    "24h": 86400, "7d": 604800, "30d": 2592000,
}


def parse_window(value: str) -> int:
    return _WINDOW_SECONDS.get(value, _WINDOW_SECONDS["1h"])


def aggregate_window(
    window: str = "1h",
    endpoint: Optional[str] = None,
    service: str = SERVICE_NAME,
) -> dict:
    coll = _get_collection()
    if coll is None:
        return {
            "available": False,
            "reason": "metrics_store_not_configured",
            "window": {"label": window},
            "endpoints": [],
        }

    seconds = parse_window(window)
    since = datetime.now(timezone.utc) - timedelta(seconds=seconds)
    match = {"ts": {"$gte": since}, "meta.service": service}
    if endpoint:
        match["meta.endpoint"] = endpoint

    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": {"endpoint": "$meta.endpoint", "method": "$meta.method"},
            "count": {"$sum": 1},
            "errors_4xx": {"$sum": {"$cond": [{"$eq": ["$meta.status_class", "4xx"]}, 1, 0]}},
            "errors_5xx": {"$sum": {"$cond": [{"$eq": ["$meta.status_class", "5xx"]}, 1, 0]}},
            "latencies": {"$push": "$latency_ms"},
            "status_codes": {"$push": "$status"},
        }},
        {"$limit": 100},
    ]
    try:
        rows = list(coll.aggregate(pipeline, allowDiskUse=True))
    except Exception:  # noqa: BLE001
        logger.exception("backend metrics aggregate failed")
        return {
            "available": False,
            "reason": "aggregation_error",
            "window": {"label": window},
            "endpoints": [],
        }

    endpoints: list[dict] = []
    for row in rows:
        latencies = [float(x) for x in (row.get("latencies") or [])]
        if len(latencies) > 10_000:
            latencies = latencies[::len(latencies) // 10_000]
        status_counts: dict[str, int] = {}
        for s in row.get("status_codes") or []:
            status_counts[str(int(s))] = status_counts.get(str(int(s)), 0) + 1
        total = int(row["count"])
        errors = int(row.get("errors_4xx", 0)) + int(row.get("errors_5xx", 0))
        endpoints.append({
            "endpoint": row["_id"]["endpoint"],
            "method": row["_id"]["method"],
            "count": total,
            "error_count": errors,
            "error_rate": round(errors / total, 4) if total else 0.0,
            "latency_ms": {
                "p50": round(_percentile(latencies, 50), 2),
                "p95": round(_percentile(latencies, 95), 2),
                "p99": round(_percentile(latencies, 99), 2),
                "max": round(max(latencies), 2) if latencies else 0.0,
                "mean": round(mean(latencies), 2) if latencies else 0.0,
                "samples": len(latencies),
            },
            "status_codes": status_counts,
        })

    endpoints.sort(key=lambda e: (e["endpoint"], e["method"]))
    return {
        "available": True,
        "service": service,
        "window": {
            "label": window,
            "since": since.isoformat(),
            "until": datetime.now(timezone.utc).isoformat(),
            "seconds": seconds,
        },
        "endpoints": endpoints,
    }


def reset_for_tests() -> None:
    global _collection, _init_attempted
    with _lock:
        _collection = None
        _init_attempted = False
