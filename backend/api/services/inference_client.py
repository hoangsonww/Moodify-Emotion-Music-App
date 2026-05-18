"""HTTP client for the Moodify Modal inference service.

After the refactor, Django no longer imports torch/transformers/etc. The
``text_emotion`` and ``music_recommendation`` views call the functions here,
which proxy to the Modal service. Speech/facial traffic does NOT pass
through Django -- the browser uploads media directly to Modal (plan §3).
"""

import logging

import requests
from decouple import config

logger = logging.getLogger(__name__)

# Base URL of the deployed Modal service, e.g. https://<org>--moodify-...modal.run
MODAL_INFERENCE_URL = config("MODAL_INFERENCE_URL", default="")
# Shared secret authenticating Django -> Modal proxy calls.
MODAL_SERVICE_TOKEN = config("MODAL_SERVICE_TOKEN", default="")

_TIMEOUT_SECONDS = 15
_MAX_RETRIES = 1


class InferenceServiceError(Exception):
    """Raised when the Modal inference service is unreachable or errors."""


def _post(path: str, json_body: dict) -> dict:
    """POST to the Modal service with the service token, one retry, timeout."""
    if not MODAL_INFERENCE_URL:
        raise InferenceServiceError("MODAL_INFERENCE_URL is not configured")

    url = f"{MODAL_INFERENCE_URL.rstrip('/')}{path}"
    headers = {"Authorization": f"Bearer {MODAL_SERVICE_TOKEN}"}

    last_exc: Exception | None = None
    for attempt in range(_MAX_RETRIES + 1):
        try:
            resp = requests.post(url, json=json_body, headers=headers, timeout=_TIMEOUT_SECONDS)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as exc:
            last_exc = exc
            logger.warning("Modal inference call %s failed (attempt %s): %s", path, attempt + 1, exc)

    raise InferenceServiceError(f"Modal inference service call to {path} failed") from last_exc


def text_emotion(text: str) -> dict:
    """Proxy a text-emotion request. Returns {emotion, recommendations, ...}."""
    return _post("/text_emotion", {"text": text})


def music_recommendation(emotion: str, market: str | None = None) -> dict:
    """Proxy a music-recommendation request."""
    return _post("/music_recommendation", {"emotion": emotion, "market": market})
