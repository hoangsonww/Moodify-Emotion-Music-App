"""Spotify-backed music recommendation.

Refactored from ai_ml/src/recommendation/music_recommendation.py +
ai_ml/src/utils.py. Legacy issue fixed: the Spotify access token was
fetched on every call; it is now cached in-process for its real TTL.
"""

import base64
import logging
import random
import threading
import time

import requests

import config

logger = logging.getLogger(__name__)

_SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
_SPOTIFY_SEARCH_URL = "https://api.spotify.com/v1/search"
_HTTP_TIMEOUT = 10

# In-process token cache (one warm container -> shared across requests).
_token_lock = threading.Lock()
_token_value: str | None = None
_token_expires_at: float = 0.0

# emotion -> Spotify search keyword. Accepts the union of labels emitted by
# the text model (sadness/joy/love/anger/fear), the speech model, and the
# facial detector, plus common synonyms.
EMOTION_TO_KEYWORD = {
    "joy": "joy",
    "happy": "happy",
    "happiness": "happy",
    "sadness": "sad",
    "sad": "sad",
    "anger": "angry",
    "angry": "angry",
    "love": "romantic",
    "fear": "calm",
    "fearful": "calm",
    "neutral": "chill",
    "calm": "peaceful",
    "disgust": "blues",
    "disgusted": "blues",
    "surprised": "party",
    "surprise": "party",
    "excited": "energetic",
    "bored": "relaxing",
    "tired": "calm",
    "relaxed": "calm",
    "stressed": "calm",
    "anxious": "calm",
    "depressed": "sad",
    "lonely": "sad",
    "energetic": "upbeat",
    "nostalgic": "retro",
    "confused": "instrumental",
    "frustrated": "aggressive",
    "hopeful": "uplifting",
    "proud": "epic",
    "guilty": "melancholic",
    "jealous": "dark",
    "ashamed": "melancholic",
    "disappointed": "sad",
    "content": "chill",
    "insecure": "soulful",
    "embarrassed": "blues",
    "overwhelmed": "ambient",
    "amused": "fun",
}

# Spotify market codes used when the caller does not specify one.
AVAILABLE_MARKETS = [
    "AU", "BR", "CA", "DE", "ES", "FR", "GB", "ID", "IN", "IT", "JP", "MX",
    "NL", "NZ", "PL", "SE", "US", "ZA",
]


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
            timeout=_HTTP_TIMEOUT,
        )
        resp.raise_for_status()
        payload = resp.json()

        _token_value = payload["access_token"]
        # Refresh 60s before the real expiry to avoid edge-of-window 401s.
        _token_expires_at = time.time() + payload.get("expires_in", 3600) - 60
        return _token_value


def get_music_recommendation(emotion: str, market: str | None = None) -> list[dict]:
    """Return a list of recommended track dicts for the given emotion.

    Returns an empty list on any Spotify failure -- recommendation problems
    must never fail the emotion-detection request.
    """
    if not emotion:
        return []

    try:
        access_token = get_spotify_access_token()
    except Exception:  # noqa: BLE001
        logger.exception("Could not obtain a Spotify access token")
        return []

    keyword = EMOTION_TO_KEYWORD.get(emotion.lower(), "pop")
    selected_market = market if market in AVAILABLE_MARKETS else random.choice(AVAILABLE_MARKETS)

    try:
        resp = requests.get(
            _SPOTIFY_SEARCH_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            params={"q": keyword, "type": "track", "limit": 10, "market": selected_market},
            timeout=_HTTP_TIMEOUT,
        )
        resp.raise_for_status()
    except requests.RequestException:
        logger.exception("Spotify search request failed (emotion=%s)", emotion)
        return []

    tracks = resp.json().get("tracks", {}).get("items", [])
    return [
        {
            "name": track["name"],
            "artist": ", ".join(a["name"] for a in track.get("artists", [])),
            "preview_url": track.get("preview_url"),
            "external_url": track.get("external_urls", {}).get("spotify"),
            "image_url": (track.get("album", {}).get("images") or [{}])[0].get("url"),
        }
        for track in tracks
    ]
