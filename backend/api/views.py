"""Emotion / recommendation endpoints.

These views contain NO machine-learning code or dependencies. Text-emotion
and music-recommendation requests are proxied to the Modal inference
service; speech and facial uploads go directly from the browser to Modal
(see docs/PRODUCTION_REFACTOR_PLAN.md §3).
"""

import logging

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .services.inference_client import InferenceServiceError, music_recommendation as modal_music
from .services.inference_client import text_emotion as modal_text

logger = logging.getLogger(__name__)

_BAD_GATEWAY = {"error": "The inference service is currently unavailable."}


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    """Lightweight liveness probe for uptime monitoring."""
    return Response({"status": "ok"}, status=status.HTTP_200_OK)


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


@api_view(["POST"])
@permission_classes([AllowAny])
def music_recommendation(request):
    """Return music recommendations for a given emotion."""
    emotion = (request.data.get("emotion") or "") if request.data else ""
    market = request.data.get("market") if request.data else None
    history = (request.data.get("history") or []) if request.data else []
    if not emotion:
        return Response({"error": "No emotion provided"}, status=status.HTTP_400_BAD_REQUEST)

    if not isinstance(history, list):
        history = []

    try:
        result = modal_music(emotion, market, history)
    except InferenceServiceError:
        logger.exception("music_recommendation proxy call failed")
        return Response(_BAD_GATEWAY, status=status.HTTP_502_BAD_GATEWAY)

    return Response(result, status=status.HTTP_200_OK)
