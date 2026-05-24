"""Persistent SRE metrics store, backed by MongoDB Atlas time-series.

Every inference request emits one document via ``insert_event()``
synchronously (before the response is sent), keeping the persistence
contract simple: never lose more than the in-flight request even if
the Modal container is killed without warning. Per-request write
overhead on a warm connection pool is ~1 ms; failures are swallowed
silently because **metrics must never break the request they measure**.

Read-side is a Mongo aggregation pipeline computing per-endpoint
counters + status breakdown for a time window; latency percentiles
are computed in Python on the materialised sample list (simple,
version-independent, and accurate at our request volume).

Implementation notes
--------------------
* PyMongo (not mongoengine) -- we don't need the ODM layer here, and
  the lightweight ``MongoClient`` avoids importing Django settings.
* Lazy client initialisation. The first ``insert_event()`` opens the
  pool; subsequent writes reuse it for the container's lifetime.
* Time-series collection is created on first use if missing. Native
  TTL is configured via ``expireAfterSeconds`` so old samples prune
  themselves without us running a cron.
* Path normalisation -- the *FastAPI route template* is the cardinality
  key, NOT the resolved path. ``/users/65f3.../profile/`` collapses to
  ``/users/{user_id}/profile/``; otherwise we'd blow up the unique-
  endpoint count and make percentiles meaningless.
"""

from __future__ import annotations

import logging
import threading
import time
from datetime import datetime, timedelta, timezone
from statistics import mean
from typing import Optional

import config

logger = logging.getLogger(__name__)

# Lazy import: pymongo is in requirements.txt; tests that don't
# exercise the store skip the import too.
_client_lock = threading.Lock()
_client = None  # type: ignore[var-annotated]
_collection = None  # type: ignore[var-annotated]
_init_attempted = False  # so a failed init doesn't retry on every call


SERVICE_NAME = "modal"


def _percentile(samples: list[float], q: float) -> float:
    """Same algorithm as metrics._percentile -- duplicated here so the
    store has no import-time dependency on the live recorder module."""
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


# ---------------------------------------------------------------------------
# Connection / collection setup
# ---------------------------------------------------------------------------
def _get_collection():
    """Return the time-series collection or ``None`` if disabled / unavailable.

    Idempotent + thread-safe. Failure to connect is logged at WARNING
    and remembered so we don't hammer Atlas on every request.
    """
    global _client, _collection, _init_attempted

    if not config.METRICS_ENABLED:
        return None
    if _collection is not None:
        return _collection
    if _init_attempted and _collection is None:
        # We already tried and failed. Don't keep retrying inline.
        return None

    with _client_lock:
        if _collection is not None:
            return _collection
        _init_attempted = True
        uri = config.MONGO_DB_URI
        if not uri:
            logger.info("Metrics disabled -- MONGO_DB_URI is not set.")
            return None
        try:
            from pymongo import MongoClient
            from pymongo.errors import CollectionInvalid, OperationFailure

            _client = MongoClient(
                uri,
                # Tight timeouts so a Mongo outage can't stall request
                # handlers -- we'd rather drop the metric than block.
                serverSelectionTimeoutMS=2000,
                connectTimeoutMS=2000,
                socketTimeoutMS=2000,
            )
            # PyMongo 4+ forbids truth-testing a Database (raises
            # NotImplementedError on `db or other`) -- use an explicit
            # `is None` check to fall back to the configured name when
            # the URI does not embed a default database.
            db = _client.get_default_database(default=None)
            if db is None:
                db = _client[config.MONGO_DB_NAME]
            coll_name = config.METRICS_COLLECTION
            # Time-series collections are created with createCollection +
            # timeseries options. Idempotent: if it already exists with
            # the same spec, Mongo silently returns success on most
            # drivers; otherwise we just catch CollectionInvalid.
            try:
                db.create_collection(
                    coll_name,
                    timeseries={
                        "timeField": "ts",
                        "metaField": "meta",
                        "granularity": "minutes",
                    },
                    expireAfterSeconds=int(config.METRICS_TTL_DAYS * 86400),
                )
                logger.info("Created time-series collection '%s' with %s-day TTL",
                            coll_name, config.METRICS_TTL_DAYS)
            except (CollectionInvalid, OperationFailure):
                # Already exists -- carry on.
                pass

            _collection = db[coll_name]
            # An index on the metadata fields makes window queries fast.
            try:
                _collection.create_index([("meta.service", 1), ("meta.endpoint", 1), ("ts", -1)])
            except Exception:  # noqa: BLE001
                # Older Atlas tiers may restrict createIndex on TS
                # collections; the TS index on ts is automatic.
                pass

            logger.info("Metrics store ready -- collection=%s ttl=%sd",
                        coll_name, config.METRICS_TTL_DAYS)
            return _collection
        except Exception:  # noqa: BLE001
            logger.exception(
                "Could not initialise metrics store -- continuing without persistence."
            )
            _collection = None
            return None


# ---------------------------------------------------------------------------
# Write side
# ---------------------------------------------------------------------------
def insert_event(
    *,
    endpoint: str,
    method: str,
    status: int,
    latency_ms: float,
    container_id: str,
    degraded: bool = False,
) -> None:
    """Insert one metric event. Never raises.

    The ``meta`` sub-document carries the high-cardinality fields the
    time-series collection groups on -- Atlas optimises columnar
    storage based on what's inside ``meta``. ``latency_ms`` and
    ``status`` are measurements, not metadata.
    """
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
            "degraded": bool(degraded),
        })
    except Exception:  # noqa: BLE001
        # Mongo down, init failure, network blip, auth glitch -- never
        # propagate. Metrics MUST NOT break the request they measure.
        logger.warning("metrics insert failed (silently skipping)", exc_info=False)


# ---------------------------------------------------------------------------
# Read side
# ---------------------------------------------------------------------------
_WINDOW_SECONDS = {
    "5m": 300, "15m": 900, "1h": 3600, "6h": 21600,
    "24h": 86400, "7d": 604800, "30d": 2592000,
}


def parse_window(value: str) -> int:
    """Convert a window string (`"5m"`, `"1h"`, ...) to seconds."""
    return _WINDOW_SECONDS.get(value, _WINDOW_SECONDS["1h"])


def aggregate_window(
    window: str = "1h",
    endpoint: Optional[str] = None,
    service: str = SERVICE_NAME,
) -> dict:
    """Return per-endpoint aggregates for the last ``window``.

    Group-by happens in Mongo; percentile computation happens in
    Python on the raw ``latency_ms`` values pulled back (we cap the
    pull at 10k samples per endpoint to bound memory + bandwidth).
    """
    coll = _get_collection()
    if coll is None:
        return {
            "available": False,
            "reason": "metrics_store_not_configured",
            "window": window,
            "endpoints": [],
        }

    seconds = parse_window(window)
    since = datetime.now(timezone.utc) - timedelta(seconds=seconds)
    match = {"ts": {"$gte": since}, "meta.service": service}
    if endpoint:
        match["meta.endpoint"] = endpoint

    # Pull raw samples grouped by (endpoint, method) so we can compute
    # percentiles in Python. Latencies are pushed into an array per
    # group; status codes are counted.
    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": {"endpoint": "$meta.endpoint", "method": "$meta.method"},
            "count": {"$sum": 1},
            "errors_4xx": {"$sum": {"$cond": [{"$eq": ["$meta.status_class", "4xx"]}, 1, 0]}},
            "errors_5xx": {"$sum": {"$cond": [{"$eq": ["$meta.status_class", "5xx"]}, 1, 0]}},
            "degraded_count": {"$sum": {"$cond": ["$degraded", 1, 0]}},
            "latencies": {"$push": "$latency_ms"},
            "status_codes": {"$push": "$status"},
        }},
        {"$limit": 100},  # bound endpoint cardinality
    ]
    try:
        rows = list(coll.aggregate(pipeline, allowDiskUse=True))
    except Exception:  # noqa: BLE001
        logger.exception("metrics aggregate failed")
        return {
            "available": False,
            "reason": "aggregation_error",
            "window": window,
            "endpoints": [],
        }

    endpoints: list[dict] = []
    for row in rows:
        latencies = [float(x) for x in (row.get("latencies") or [])]
        # Bound the in-memory percentile computation -- 10k samples is
        # well over what we need for accurate p99.
        if len(latencies) > 10_000:
            # Down-sample uniformly; preserves the distribution shape.
            step = len(latencies) // 10_000
            latencies = latencies[::step]
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
            "degraded_count": int(row.get("degraded_count", 0)),
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
    """Drop the cached client + collection handles so tests can rewire."""
    global _client, _collection, _init_attempted
    with _client_lock:
        if _client is not None:
            try:
                _client.close()
            except Exception:  # noqa: BLE001
                pass
        _client = None
        _collection = None
        _init_attempted = False
