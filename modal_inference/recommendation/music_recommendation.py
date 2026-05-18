"""Spotify-backed music recommendation.

Refactored from ai_ml/src/recommendation/music_recommendation.py +
ai_ml/src/utils.py. Legacy issue fixed here: the Spotify access token was
fetched on every call (plan problem #6); it is now cached for its real TTL.
"""

import base64
import logging
import threading
import time

import requests

import config

logger = logging.getLogger(__name__)

_SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
_SPOTIFY_SEARCH_URL = "https://api.spotify.com/v1/search"

# In-process token cache (one warm container -> shared across requests).
_token_lock = threading.Lock()
_token_value: str | None = None
_token_expires_at: float = 0.0

# emotion -> Spotify search keyword. Port the full map from the legacy file.
EMOTION_TO_KEYWORD = {
    "joy": "joy",
    "happy": "happy",
    "sadness": "sad",
    "anger": "angry",
    "love": "romantic",
    "fear": "calm",
    "neutral": "chill",
    "calm": "peaceful",
    # TODO(impl): port the remaining entries from the legacy file.
}


def get_spotify_access_token() -> str:
    """Return a cached Spotify access token, refreshing only when expired."""
    global _token_value, _token_expires_at

    with _token_lock:
        if _token_value and time.time() < _token_expires_at:
            return _token_value

        client_id = config.require("SPOTIFY_CLIENT_ID")
        client_secret = config.require("SPOTIFY_CLIENT_SECRET")
        encoded = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()

        resp = requests.post(
            _SPOTIFY_TOKEN_URL,
            headers={"Authorization": f"Basic {encoded}"},
            data={"grant_type": "client_credentials"},
            timeout=10,
        )
        resp.raise_for_status()
        payload = resp.json()

        _token_value = payload["access_token"]
        # Refresh 60 s before the real expiry to avoid edge-of-window 401s.
        _token_expires_at = time.time() + payload.get("expires_in", 3600) - 60
        return _token_value


def get_music_recommendation(emotion: str, market: str | None = None) -> list[dict]:
    """Return a list of track dicts for the given emotion.

    TODO(impl): port the search + response-parsing logic from the legacy
    file. Returns [] on any Spotify failure (do not raise into the request).
    Track dict shape: {name, artist, preview_url, external_url, image_url}.
    """
    raise NotImplementedError(
        "TODO(impl): port from ai_ml/src/recommendation/music_recommendation.py"
    )
