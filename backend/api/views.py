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

from .services.inference_client import InferenceServiceError, music_recommendation as modal_music
from .services.inference_client import text_emotion as modal_text

logger = logging.getLogger(__name__)

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
    if not emotion:
        return Response({"error": "No emotion provided"}, status=status.HTTP_400_BAD_REQUEST)

    # Keep only recent moods, as strings -- the inference service caps the
    # history at 50 entries and rejects a longer or malformed list.
    if not isinstance(history, list):
        history = []
    history = [str(mood) for mood in history[-50:]]

    try:
        result = modal_music(emotion, market, history)
    except InferenceServiceError:
        logger.exception("music_recommendation proxy call failed")
        return Response(_BAD_GATEWAY, status=status.HTTP_502_BAD_GATEWAY)

    return Response(result, status=status.HTTP_200_OK)
