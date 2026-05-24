"""HTTP client for the Moodify Modal inference service.

Django no longer imports torch/transformers/etc. The ``text_emotion`` and
``music_recommendation`` views call the functions here, which proxy to the
Modal service. Speech/facial traffic does NOT pass through Django -- the
browser uploads media directly to Modal (plan §3).
"""

import logging
import time

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

_TIMEOUT_SECONDS = 15
_MAX_RETRIES = 1
_RETRY_BACKOFF_SECONDS = 1.0


class InferenceServiceError(Exception):
    """Raised when the Modal inference service is unreachable or errors."""


def _post(path: str, json_body: dict) -> dict:
    """POST to the Modal service with the service token, with one retry."""
    base_url = getattr(settings, "MODAL_INFERENCE_URL", "")
    if not base_url:
        raise InferenceServiceError("MODAL_INFERENCE_URL is not configured")

    url = f"{base_url.rstrip('/')}{path}"
    headers = {"Authorization": f"Bearer {getattr(settings, 'MODAL_SERVICE_TOKEN', '')}"}

    last_exc: Exception | None = None
    for attempt in range(_MAX_RETRIES + 1):
        try:
            resp = requests.post(url, json=json_body, headers=headers, timeout=_TIMEOUT_SECONDS)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as exc:
            last_exc = exc
            logger.warning("Modal call %s failed (attempt %s/%s): %s", path, attempt + 1, _MAX_RETRIES + 1, exc)
            if attempt < _MAX_RETRIES:
                time.sleep(_RETRY_BACKOFF_SECONDS * (attempt + 1))

    raise InferenceServiceError(f"Modal inference service call to {path} failed") from last_exc


def text_emotion(text: str) -> dict:
    """Proxy a text-emotion request. Returns {emotion, recommendations, ...}."""
    return _post("/text_emotion", {"text": text})


def music_recommendation(
    emotion: str,
    market: str | None = None,
    history: list[str] | None = None,
    genre: str | None = None,
) -> dict:
    """Proxy a music-recommendation request."""
    payload: dict = {
        "emotion": emotion,
        "market": market,
        "history": history or [],
    }
    # Only forward genre when set; Modal treats the field as optional but
    # avoids an extra null hop when we don't have a value.
    if genre:
        payload["genre"] = genre
    return _post("/music_recommendation", payload)
