"""``POST /api/feedback/`` -- unified user-feedback endpoint.

Two surfaces share one URL because the auth, throttling, and persistence
paths are identical and the discriminator (``kind``) is one byte. Keeping
them separate would mean duplicating the validator + the swagger schema
for no gain.

Phase 1 behaviour (this commit):
* Accept and persist both kinds to Mongo time-series collections.
* For ``kind=mood``, also bump the user's per-user calibration counter
  on ``UserProfile.mood_calibration`` (the L1 layer from the plan).
  Inference itself does NOT yet consult that map -- that wire-up lands
  in Phase 3 alongside the dominant-correction threshold.
* For ``kind=track``, just persist. The bandit posterior (Phase 4)
  reads the event log to seed itself, so we capture from day one.

Nothing user-visible changes until Phase 2 lights up the widgets.
"""

from __future__ import annotations

import logging

from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from backend.api_docs import RESP_401, Tags, _obj, error_response, ok_message

from . import bandit, feedback_store, track_features
from .models import UserProfile

logger = logging.getLogger(__name__)

# Canonical labels = BERT classifier outputs + the "neutral" fallback.
# Kept here (not imported from modal_inference) because the Django app
# must not depend on the inference image; the value is small and frozen.
_CANONICAL_EMOTIONS = frozenset({
    "sadness", "joy", "love", "anger", "fear", "neutral",
})

_KIND_MOOD = "mood"
_KIND_TRACK = "track"

# Loose upper bounds -- enough to fit any real payload, tight enough to
# bound the cost of a malicious caller spamming the endpoint.
_MAX_TRACK_ID_LEN = 128
_MAX_SESSION_ID_LEN = 128


# ---------------------------------------------------------------------------
# Swagger schemas
# ---------------------------------------------------------------------------
_MOOD_FEEDBACK_BODY = _obj(
    properties={
        "kind": openapi.Schema(type=openapi.TYPE_STRING, enum=[_KIND_MOOD],
                               example=_KIND_MOOD),
        "predicted": openapi.Schema(type=openapi.TYPE_STRING,
                                    enum=sorted(_CANONICAL_EMOTIONS),
                                    example="joy",
                                    description="The label the model produced."),
        "actual": openapi.Schema(type=openapi.TYPE_STRING,
                                 enum=sorted(_CANONICAL_EMOTIONS),
                                 example="love",
                                 description="The label the user says is correct."),
        "input_type": openapi.Schema(type=openapi.TYPE_STRING,
                                     enum=sorted(feedback_store.INPUT_TYPES),
                                     example="text"),
        "confidence": openapi.Schema(type=openapi.TYPE_NUMBER, format="float",
                                     minimum=0.0, maximum=1.0, nullable=True,
                                     example=0.82,
                                     description="Optional softmax probability for the predicted label."),
        "session_id": openapi.Schema(type=openapi.TYPE_STRING, nullable=True,
                                     example="b1c8...-uuid",
                                     description="Optional client-side session id used to correlate corrections."),
    },
    required=["kind", "predicted", "actual", "input_type"],
)

_TRACK_FEEDBACK_BODY = _obj(
    properties={
        "kind": openapi.Schema(type=openapi.TYPE_STRING, enum=[_KIND_TRACK],
                               example=_KIND_TRACK),
        "track_id": openapi.Schema(type=openapi.TYPE_STRING,
                                   example="deezer:12345",
                                   description="Stable identifier for the rated track."),
        "signal": openapi.Schema(type=openapi.TYPE_STRING,
                                 enum=sorted(feedback_store.TRACK_SIGNALS),
                                 example="like"),
        "context_emotion": openapi.Schema(type=openapi.TYPE_STRING, nullable=True,
                                          example="joy",
                                          description="The emotion that produced the recommendation list this rating belongs to."),
        "track": openapi.Schema(
            type=openapi.TYPE_OBJECT, nullable=True,
            description=(
                "Optional full track dict (same shape the recommender "
                "returns). When supplied, the bandit posterior is "
                "updated for the signed-in user; when omitted, only "
                "the event log is written and the posterior is left "
                "untouched."
            ),
        ),
    },
    required=["kind", "track_id", "signal"],
)

# drf-yasg doesn't model `oneOf` cleanly across drf versions; the body
# schema renders as the mood variant with the track variant called out
# in the description. Validation enforces the real contract.
_FEEDBACK_BODY = _MOOD_FEEDBACK_BODY


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
def _validate(payload: dict) -> tuple[dict | None, str | None]:
    """Return (cleaned_payload, None) on success; (None, error) otherwise."""
    if not isinstance(payload, dict):
        return None, "Body must be a JSON object."

    kind = payload.get("kind")
    if kind == _KIND_MOOD:
        return _validate_mood(payload)
    if kind == _KIND_TRACK:
        return _validate_track(payload)
    return None, "Field 'kind' must be either 'mood' or 'track'."


def _validate_mood(payload: dict) -> tuple[dict | None, str | None]:
    predicted = (payload.get("predicted") or "").strip().lower()
    actual = (payload.get("actual") or "").strip().lower()
    input_type = (payload.get("input_type") or "").strip().lower()

    if predicted not in _CANONICAL_EMOTIONS:
        return None, f"Field 'predicted' must be one of {sorted(_CANONICAL_EMOTIONS)}."
    if actual not in _CANONICAL_EMOTIONS:
        return None, f"Field 'actual' must be one of {sorted(_CANONICAL_EMOTIONS)}."
    if input_type not in feedback_store.INPUT_TYPES:
        return None, f"Field 'input_type' must be one of {sorted(feedback_store.INPUT_TYPES)}."

    confidence = payload.get("confidence")
    if confidence is not None:
        try:
            confidence = float(confidence)
        except (TypeError, ValueError):
            return None, "Field 'confidence' must be a number between 0 and 1."
        if not 0.0 <= confidence <= 1.0:
            return None, "Field 'confidence' must be between 0 and 1."

    session_id = payload.get("session_id")
    if session_id is not None:
        if not isinstance(session_id, str) or len(session_id) > _MAX_SESSION_ID_LEN:
            return None, f"Field 'session_id' must be a string of <= {_MAX_SESSION_ID_LEN} chars."

    return {
        "kind": _KIND_MOOD,
        "predicted": predicted,
        "actual": actual,
        "input_type": input_type,
        "confidence": confidence,
        "session_id": session_id,
    }, None


def _validate_track(payload: dict) -> tuple[dict | None, str | None]:
    track_id = payload.get("track_id")
    signal = (payload.get("signal") or "").strip().lower()
    context_emotion = payload.get("context_emotion")
    track = payload.get("track")

    if not isinstance(track_id, str) or not track_id.strip():
        return None, "Field 'track_id' is required."
    track_id = track_id.strip()
    if len(track_id) > _MAX_TRACK_ID_LEN:
        return None, f"Field 'track_id' must be <= {_MAX_TRACK_ID_LEN} chars."

    if signal not in feedback_store.TRACK_SIGNALS:
        return None, f"Field 'signal' must be one of {sorted(feedback_store.TRACK_SIGNALS)}."

    if context_emotion is not None:
        if not isinstance(context_emotion, str):
            return None, "Field 'context_emotion' must be a string."
        context_emotion = context_emotion.strip().lower() or None
        if context_emotion is not None and context_emotion not in _CANONICAL_EMOTIONS:
            return None, f"Field 'context_emotion' must be one of {sorted(_CANONICAL_EMOTIONS)}."

    if track is not None and not isinstance(track, dict):
        return None, "Field 'track' must be a JSON object when supplied."

    return {
        "kind": _KIND_TRACK,
        "track_id": track_id,
        "signal": signal,
        "context_emotion": context_emotion,
        "track": track,
    }, None


# ---------------------------------------------------------------------------
# Calibration map update (Surface 1, L1)
# ---------------------------------------------------------------------------
def _bump_calibration(username: str, predicted: str, actual: str) -> None:
    """Increment ``mood_calibration[predicted][actual]`` on the profile.

    Never raises -- a failure here must not poison the persisted event.
    """
    if predicted == actual:
        # No correction signal -- user just confirmed. Still worth
        # persisting in the event log (handled by the caller), but not
        # worth muddying the calibration map with self-mappings.
        return
    try:
        profile = UserProfile.objects(username=username).first()
        if profile is None:
            return
        calibration = dict(profile.mood_calibration or {})
        bucket = dict(calibration.get(predicted, {}) or {})
        bucket[actual] = int(bucket.get(actual, 0)) + 1
        calibration[predicted] = bucket
        profile.mood_calibration = calibration
        profile.save()
    except Exception:  # noqa: BLE001
        logger.warning(
            "mood calibration bump failed for user=%s (silently skipping)",
            username,
        )


def _update_taste_profile(
    username: str,
    *,
    track: dict | None,
    signal: str,
    context_emotion: str | None,
) -> None:
    """Apply one feedback signal to the user's Beta-Bernoulli posterior.

    No-op when the caller omitted the ``track`` field -- without it we
    can't extract the feature vector and the bandit cannot learn from
    the event. The raw event is still persisted upstream so we don't
    lose the signal entirely.

    Never raises.
    """
    if track is None:
        return
    try:
        features = track_features.featurize(track, context_emotion=context_emotion)
    except Exception:  # noqa: BLE001
        logger.warning(
            "feature extraction failed for user=%s -- skipping bandit update",
            username,
        )
        return

    try:
        profile = UserProfile.objects(username=username).first()
        if profile is None:
            return
        updated = bandit.update_posterior(
            profile.taste_profile or {}, features, signal
        )
        profile.taste_profile = updated
        profile.save()
    except Exception:  # noqa: BLE001
        logger.warning(
            "taste_profile update failed for user=%s (silently skipping)",
            username,
        )


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------
@swagger_auto_schema(
    method="post",
    tags=[Tags.INFERENCE],
    operation_summary="Submit mood / track feedback",
    operation_description=(
        "Single endpoint for both RL surfaces.\n\n"
        "**Mood correction (`kind=\"mood\"`)** -- record that the user "
        "disagreed (or agreed) with a detected emotion. Per-user calibration "
        "is updated immediately; the global classifier is fine-tuned offline "
        "from the accumulated log.\n\n"
        "**Track signal (`kind=\"track\"`)** -- record a 👍 / 👎 / Open-in-"
        "Deezer event for a track. Feeds the Thompson Sampling bandit re-ranker.\n\n"
        "Requires a user JWT (`Authorization: Bearer <access>`). The endpoint "
        "is intentionally idempotent at the persistence layer -- repeat calls "
        "accumulate, they don't fail. Returns **202** on success because "
        "downstream effects (calibration map, bandit posterior) settle out-of-band."
    ),
    request_body=_FEEDBACK_BODY,
    responses={
        202: ok_message("Feedback accepted.", "Feedback recorded."),
        400: error_response("Schema validation failed.",
                            "Field 'kind' must be either 'mood' or 'track'."),
        401: RESP_401,
    },
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def feedback(request):
    """Persist a mood correction or a track signal for the signed-in user."""
    cleaned, error = _validate(request.data or {})
    if error is not None:
        return Response({"error": error}, status=status.HTTP_400_BAD_REQUEST)

    username = request.user.username
    assert cleaned is not None  # narrowing for type-checkers

    if cleaned["kind"] == _KIND_MOOD:
        feedback_store.insert_mood_feedback(
            username=username,
            predicted=cleaned["predicted"],
            actual=cleaned["actual"],
            input_type=cleaned["input_type"],
            confidence=cleaned["confidence"],
            session_id=cleaned["session_id"],
        )
        _bump_calibration(username, cleaned["predicted"], cleaned["actual"])
    else:
        feedback_store.insert_track_feedback(
            username=username,
            track_id=cleaned["track_id"],
            signal=cleaned["signal"],
            context_emotion=cleaned["context_emotion"],
        )
        _update_taste_profile(
            username,
            track=cleaned["track"],
            signal=cleaned["signal"],
            context_emotion=cleaned["context_emotion"],
        )

    return Response(
        {"message": "Feedback recorded."},
        status=status.HTTP_202_ACCEPTED,
    )


@swagger_auto_schema(
    method="get",
    tags=[Tags.INFERENCE],
    operation_summary="Read the user's like/dislike state for tracks",
    operation_description=(
        "Returns the signed-in user's latest explicit vote for each track id "
        "in the comma-separated `ids` query param, so the UI can restore the "
        "like/dislike button state after a reload. Implicit `open_deezer` "
        "signals are excluded."
    ),
    responses={
        200: ok_message("Map of track_id -> 'like' | 'unlike'.", "{}"),
        401: RESP_401,
    },
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def track_feedback_state(request):
    """Return ``{feedback: {track_id: 'like'|'unlike'}}`` for the caller."""
    raw = request.query_params.get("ids", "") or ""
    # Cap the batch so a crafted query can't issue an unbounded $in.
    track_ids = [t for t in (s.strip() for s in raw.split(",")) if t][:200]
    username = getattr(request.user, "username", None)
    if not username or not track_ids:
        return Response({"feedback": {}})
    fb = feedback_store.query_track_feedback(username, track_ids)
    return Response({"feedback": fb})
