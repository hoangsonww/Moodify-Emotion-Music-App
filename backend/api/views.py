"""Emotion / recommendation endpoints.

These views contain NO machine-learning code or dependencies. Text-emotion
and music-recommendation requests are proxied to the Modal inference
service; speech and facial uploads go directly from the browser to Modal
(see docs/PRODUCTION_REFACTOR_PLAN.md §3).
"""

import logging

from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from backend.api_docs import (
    ARRAY_OF_TRACKS,
    Tags,
    error_response,
    _obj,
)

from . import bandit
from .calibration import apply_calibration
from .models import UserProfile
from .services.inference_client import InferenceServiceError, music_recommendation as modal_music
from .services.inference_client import text_emotion as modal_text

logger = logging.getLogger(__name__)


def _profile_for_request(request):
    """Return the caller's UserProfile if they are signed in, else None.

    Anonymous and unrecognised users never trigger a DB hit beyond the
    cheap username lookup -- and never block the request path on
    Mongo: every failure falls back to None and the rule-based
    pipeline runs unchanged.
    """
    user = getattr(request, "user", None)
    if user is None or not getattr(user, "is_authenticated", False):
        return None
    username = getattr(user, "username", None)
    if not username:
        return None
    try:
        return UserProfile.objects(username=username).first()
    except Exception:  # noqa: BLE001
        logger.warning(
            "profile lookup failed for user=%s -- skipping personalisation",
            username,
        )
        return None

_BAD_GATEWAY = {"error": "The inference service is currently unavailable."}


# ---------------------------------------------------------------------------
# Schemas used by the @swagger_auto_schema decorators below.
# ---------------------------------------------------------------------------
_TEXT_EMOTION_BODY = _obj(
    properties={
        "text": openapi.Schema(
            type=openapi.TYPE_STRING,
            minLength=1,
            maxLength=5000,
            example="I just got the job I've been hoping for. Feels unreal.",
            description="Free-form text to classify. Between 1 and 5000 characters.",
        ),
    },
    required=["text"],
)

_MUSIC_BODY = _obj(
    properties={
        "emotion": openapi.Schema(type=openapi.TYPE_STRING, example="joy",
                                  description="An emotion label (e.g. one returned by `/api/text_emotion/`)."),
        "market": openapi.Schema(type=openapi.TYPE_STRING, nullable=True, example="US",
                                 description="(Accepted for parity with the old Spotify API; ignored by the Deezer recommender.)"),
        "history": openapi.Schema(
            type=openapi.TYPE_ARRAY,
            items=openapi.Items(type=openapi.TYPE_STRING),
            example=["sadness", "sadness", "joy"],
            description="Recent moods (oldest first). Used to blend recurring-mood tracks into the result. Max 50 entries — extras are ignored.",
        ),
    },
    required=["emotion"],
)

_EMOTION_RESPONSE = _obj(
    properties={
        "emotion": openapi.Schema(type=openapi.TYPE_STRING, example="joy"),
        "recommendations": ARRAY_OF_TRACKS,
        "degraded": openapi.Schema(type=openapi.TYPE_BOOLEAN, example=False,
                                   description="True if a model failure forced a fallback emotion."),
        "market": openapi.Schema(type=openapi.TYPE_STRING, nullable=True, example=None),
    },
)


@swagger_auto_schema(
    method="get",
    tags=[Tags.SYSTEM],
    operation_summary="Liveness probe",
    operation_description=(
        "Returns `{\"status\": \"ok\"}` if the Django process is "
        "responding. Does NOT check Mongo or the downstream Modal "
        "service — it's deliberately the cheapest possible probe so "
        "uptime monitors don't accidentally rate-limit themselves."
    ),
    responses={
        200: openapi.Response(
            description="Server is alive.",
            schema=_obj(properties={"status": openapi.Schema(type=openapi.TYPE_STRING, example="ok")}),
            examples={"application/json": {"status": "ok"}},
        ),
    },
)
@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    """Lightweight liveness probe for uptime monitoring."""
    return Response({"status": "ok"}, status=status.HTTP_200_OK)


@swagger_auto_schema(
    method="post",
    tags=[Tags.INFERENCE],
    operation_summary="Detect emotion from text",
    operation_description=(
        "Proxies the request to the Modal inference service, which "
        "runs a fine-tuned BERT classifier on the input string and "
        "returns the predicted emotion plus a fresh Deezer "
        "recommendation list for that mood. **No auth required** — "
        "Django uses the shared service token to call Modal on behalf "
        "of anonymous callers, and DRF's `AnonRateThrottle` (60/min) "
        "applies. Text input is capped at 5000 characters by Modal."
    ),
    request_body=_TEXT_EMOTION_BODY,
    responses={
        200: openapi.Response(
            description="Predicted emotion + recommendations.",
            schema=_EMOTION_RESPONSE,
            examples={"application/json": {
                "emotion": "joy",
                "recommendations": [
                    {"name": "Blinding Lights", "artist": "The Weeknd",
                     "album": "After Hours",
                     "preview_url": "https://cdns-preview-1.dzcdn.net/.../preview.mp3",
                     "external_url": "https://www.deezer.com/track/916424",
                     "image_url": "https://cdns-images.dzcdn.net/.../250x250.jpg",
                     "popularity": 92, "duration_ms": 200000, "release_date": None},
                ],
                "degraded": False,
                "market": None,
            }},
        ),
        400: error_response("Body is missing the `text` field.", "No text provided"),
        502: error_response("The Modal inference service is unreachable.",
                            "The inference service is currently unavailable."),
    },
)
@api_view(["POST"])
@permission_classes([AllowAny])
def text_emotion(request):
    """Detect the emotion in a piece of text and return recommendations."""
    text = (request.data.get("text") or "") if request.data else ""
    if not text:
        return Response({"error": "No text provided"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        result = modal_text(text)
    except InferenceServiceError:
        logger.exception("text_emotion proxy call failed")
        return Response(_BAD_GATEWAY, status=status.HTTP_502_BAD_GATEWAY)

    # L1 mood calibration: rewrite the predicted emotion for authenticated
    # callers when they have a dominant correction on record. Anonymous
    # callers see the model's raw output -- no calibration, no DB hit.
    profile = _profile_for_request(request)
    if profile is not None and isinstance(result, dict) and result.get("emotion"):
        original = result["emotion"]
        calibrated = apply_calibration(original, profile.mood_calibration or {})
        if calibrated != original:
            result = dict(result)
            result["emotion"] = calibrated
            result["calibrated_from"] = original

    return Response(result, status=status.HTTP_200_OK)


@swagger_auto_schema(
    method="post",
    tags=[Tags.MUSIC],
    operation_summary="Mood → Deezer recommendations",
    operation_description=(
        "Returns a list of Deezer tracks matched to the given emotion. "
        "When `history` is provided, the Modal recommender blends in "
        "tracks for the user's recurring mood via a recency-weighted "
        "affinity model + first-order Markov transitions. The blend is "
        "fully explainable — see the [Modal inference README]"
        "(https://github.com/hoangsonww/Moodify-Emotion-Music-App/blob/master/modal_inference/README.md#personalization-model-lightweight-ml) "
        "for the formulas.\n\n"
        "**No auth required** — Django uses the shared service token "
        "to call Modal. DRF's `AnonRateThrottle` (60/min) applies. "
        "`market` is accepted for backwards compatibility with the "
        "previous Spotify-based recommender but is ignored by Deezer."
    ),
    request_body=_MUSIC_BODY,
    responses={
        200: openapi.Response(description="Mood + recommendations.", schema=_EMOTION_RESPONSE),
        400: error_response("Body is missing the `emotion` field.", "No emotion provided"),
        502: error_response("The Modal inference service is unreachable.",
                            "The inference service is currently unavailable."),
    },
)
@api_view(["POST"])
@permission_classes([AllowAny])
def music_recommendation(request):
    """Return music recommendations for a given emotion."""
    emotion = (request.data.get("emotion") or "") if request.data else ""
    market = request.data.get("market") if request.data else None
    history = (request.data.get("history") or []) if request.data else []
    genre = (request.data.get("genre") or None) if request.data else None
    if not emotion:
        return Response({"error": "No emotion provided"}, status=status.HTTP_400_BAD_REQUEST)

    # Keep only recent moods, as strings -- the inference service caps the
    # history at 50 entries and rejects a longer or malformed list.
    if not isinstance(history, list):
        history = []
    history = [str(mood) for mood in history[-50:]]

    if genre is not None and not isinstance(genre, str):
        genre = None

    try:
        result = modal_music(emotion, market, history, genre)
    except InferenceServiceError:
        logger.exception("music_recommendation proxy call failed")
        return Response(_BAD_GATEWAY, status=status.HTTP_502_BAD_GATEWAY)

    # Bandit re-rank: when the caller is signed in AND has cleared the
    # cold-start floor, reorder the candidate list by Thompson-sampled
    # posterior score. Cold users (and anonymous traffic) get the
    # EWMA+Markov order back unchanged -- the bandit is identity-when-cold
    # by construction.
    profile = _profile_for_request(request)
    if profile is not None and isinstance(result, dict):
        recs = result.get("recommendations") or []
        if recs:
            try:
                reranked = bandit.rerank(
                    list(recs),
                    taste_profile=profile.taste_profile or {},
                    context_emotion=result.get("emotion") or emotion,
                )
                if reranked is not recs:
                    result = dict(result)
                    result["recommendations"] = reranked
            except Exception:  # noqa: BLE001
                logger.warning(
                    "bandit rerank failed for user=%s -- returning base order",
                    profile.username,
                    exc_info=False,
                )

    return Response(result, status=status.HTTP_200_OK)
