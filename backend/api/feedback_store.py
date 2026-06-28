"""Persistent feedback store for the RL surfaces.

Backs two Mongo time-series collections on the same Atlas cluster the
rest of the app uses:

* ``mood_feedback`` -- one row per user mood correction (Surface 1).
* ``track_feedback`` -- one row per 👍 / 👎 / open-in-Deezer signal
  (Surface 2).

Same operational contract as ``observability/store.py``:

* Per-request synchronous write (~1 ms on a warm connection, capped by
  ``serverSelectionTimeoutMS`` otherwise).
* Failures are swallowed silently -- feedback MUST NOT break a request.
* Native time-series TTL prunes old samples; no cron required.
* Each collection is created lazily on first write so cold-start cost
  is zero for users who never send feedback.

The mongoengine connection opened in ``backend/settings.py`` is reused
via ``get_connection()`` -- a second pool would double Atlas's
per-instance connection footprint for no benefit.
"""

from __future__ import annotations

import logging
import threading
from datetime import datetime, timezone
from typing import Optional

from django.conf import settings

logger = logging.getLogger(__name__)


MOOD_KIND = "mood"
TRACK_KIND = "track"

# Allowed values, enforced both here (defence in depth for a direct
# store call) and at the endpoint validator.
INPUT_TYPES = frozenset({"text", "speech", "facial"})
# "clear" retracts a previous like/unlike: it records the un-vote so the
# button state stays in sync after a reload, and triggers a posterior
# reversal on the read side. It is NOT a learning signal of its own.
TRACK_SIGNALS = frozenset({"like", "unlike", "open_deezer", "clear"})

_lock = threading.Lock()
_mood_collection = None  # type: ignore[var-annotated]
_track_collection = None  # type: ignore[var-annotated]
_init_attempted: dict[str, bool] = {MOOD_KIND: False, TRACK_KIND: False}


def _get_collection(kind: str):
    """Return the named time-series collection or None if unavailable.

    ``kind`` is ``"mood"`` or ``"track"``; anything else raises
    ``ValueError`` (programmer error, not a user-data path).
    """
    global _mood_collection, _track_collection

    if kind not in (MOOD_KIND, TRACK_KIND):
        raise ValueError(f"Unknown feedback kind: {kind!r}")

    if not getattr(settings, "FEEDBACK_ENABLED", True):
        return None

    cached = _mood_collection if kind == MOOD_KIND else _track_collection
    if cached is not None:
        return cached
    if _init_attempted[kind] and cached is None:
        return None

    with _lock:
        cached = _mood_collection if kind == MOOD_KIND else _track_collection
        if cached is not None:
            return cached
        _init_attempted[kind] = True
        try:
            from mongoengine.connection import get_connection
            from pymongo.errors import CollectionInvalid, OperationFailure

            client = get_connection()
            db_name = (
                getattr(settings, "MONGO_DB_NAME", None)
                or "emotion_based_music_db"
            )
            db = client[db_name]

            if kind == MOOD_KIND:
                coll_name = getattr(
                    settings, "FEEDBACK_MOOD_COLLECTION", "mood_feedback"
                )
            else:
                coll_name = getattr(
                    settings, "FEEDBACK_TRACK_COLLECTION", "track_feedback"
                )

            ttl_seconds = (
                int(getattr(settings, "FEEDBACK_TTL_DAYS", 365)) * 86400
            )
            try:
                db.create_collection(
                    coll_name,
                    timeseries={
                        "timeField": "ts",
                        "metaField": "meta",
                        "granularity": "hours",
                    },
                    expireAfterSeconds=ttl_seconds,
                )
                logger.info("Created feedback collection '%s'", coll_name)
            except (CollectionInvalid, OperationFailure):
                # Already exists -- carry on.
                pass

            coll = db[coll_name]
            try:
                coll.create_index([("meta.username", 1), ("ts", -1)])
            except Exception:  # noqa: BLE001
                pass

            if kind == MOOD_KIND:
                _mood_collection = coll
            else:
                _track_collection = coll
            return coll
        except Exception:  # noqa: BLE001
            logger.exception(
                "Feedback store init failed for kind=%s -- continuing "
                "without persistence.",
                kind,
            )
            return None


def insert_mood_feedback(
    *,
    username: str,
    predicted: str,
    actual: str,
    input_type: str,
    confidence: Optional[float] = None,
    session_id: Optional[str] = None,
) -> None:
    """Insert one mood-correction event. Never raises."""
    try:
        coll = _get_collection(MOOD_KIND)
        if coll is None:
            return
        doc = {
            "ts": datetime.now(timezone.utc),
            "meta": {
                "username": username,
                "input_type": input_type,
                "predicted": predicted,
                "actual": actual,
            },
            # Confidence + session_id live outside meta because their
            # cardinality is too high to be useful for time-series
            # bucketing.
            "confidence": float(confidence) if confidence is not None else None,
            "session_id": session_id,
        }
        coll.insert_one(doc)
    except Exception:  # noqa: BLE001
        logger.warning("mood feedback insert failed (silently skipping)")


def insert_track_feedback(
    *,
    username: str,
    track_id: str,
    signal: str,
    context_emotion: Optional[str] = None,
) -> None:
    """Insert one track-feedback event. Never raises."""
    try:
        coll = _get_collection(TRACK_KIND)
        if coll is None:
            return
        coll.insert_one({
            "ts": datetime.now(timezone.utc),
            "meta": {
                "username": username,
                "signal": signal,
                "context_emotion": context_emotion,
            },
            "track_id": track_id,
        })
    except Exception:  # noqa: BLE001
        logger.warning("track feedback insert failed (silently skipping)")


def query_track_feedback(username: str, track_ids) -> dict:
    """Return ``{track_id: "like" | "unlike"}`` for the user's current vote.

    The current vote is the user's latest of like / unlike / clear for each
    track. A trailing ``clear`` (the un-vote) means there is NO active vote,
    so that track is omitted. The implicit ``open_deezer`` signal is never
    considered. ``track_ids`` is an iterable of the ids currently on screen.
    Never raises; returns ``{}`` on any failure (feedback is best-effort).
    """
    out: dict = {}
    try:
        ids = [str(t) for t in (track_ids or []) if t]
        if not ids:
            return out
        coll = _get_collection(TRACK_KIND)
        if coll is None:
            return out
        cursor = coll.aggregate([
            {"$match": {
                "meta.username": username,
                "meta.signal": {"$in": ["like", "unlike", "clear"]},
                "track_id": {"$in": ids},
            }},
            {"$sort": {"ts": 1}},
            {"$group": {"_id": "$track_id", "signal": {"$last": "$meta.signal"}}},
        ])
        for row in cursor:
            sig = row.get("signal")
            # A trailing "clear" means the vote was retracted -> no state.
            if sig in ("like", "unlike"):
                out[row["_id"]] = sig
    except Exception:  # noqa: BLE001
        logger.warning("track feedback query failed (silently skipping)")
    return out


def reset_for_tests() -> None:
    """Drop cached collection handles so the next call re-initialises."""
    global _mood_collection, _track_collection
    with _lock:
        _mood_collection = None
        _track_collection = None
        _init_attempted[MOOD_KIND] = False
        _init_attempted[TRACK_KIND] = False
