"""Spotify-backed music recommendation.

Recommendations are built from *curated mood playlists*: for a detected
emotion we search Spotify for matching playlists and sample tracks from
one. This produces genuinely mood-matched results -- far better than a
plain keyword track search, where ``q=joy`` only matches tracks with the
word "joy" in their metadata.

This deliberately does NOT use Spotify's ``/v1/recommendations`` or
audio-features endpoints: Spotify deprecated those (Nov 2024) and apps
created afterwards receive 403s. Playlist search + playlist tracks are
core, still-supported endpoints. A keyword track search is kept as a
fallback so a result is still returned when no playlist matches.

The token is cached in-process for its real TTL; requests transparently
refresh on 401 and back off once on 429.
"""

import base64
import logging
import random
import threading
import time

import requests

import config

logger = logging.getLogger(__name__)

_TOKEN_URL = "https://accounts.spotify.com/api/token"
_SEARCH_URL = "https://api.spotify.com/v1/search"
_PLAYLIST_TRACKS_URL = "https://api.spotify.com/v1/playlists/{playlist_id}/tracks"
_HTTP_TIMEOUT = 10
_RESULT_SIZE = 12          # tracks returned to the caller
_MIN_USABLE_TRACKS = 4     # a playlist must yield at least this many

# Detected emotion -> a search phrase that matches well-curated mood
# playlists. Covers every label the text, speech and facial models emit,
# plus common synonyms; anything unmapped falls back to _DEFAULT_QUERY.
EMOTION_TO_QUERY = {
    "joy": "happy feel good",
    "happy": "happy feel good",
    "happiness": "happy feel good",
    "sadness": "sad songs",
    "sad": "sad songs",
    "love": "love songs romance",
    "anger": "angry rock",
    "angry": "angry rock",
    "fear": "calm soothing",
    "fearful": "calm soothing",
    "neutral": "chill vibes",
    "calm": "peaceful calm",
    "disgust": "moody blues",
    "disgusted": "moody blues",
    "surprised": "upbeat party",
    "surprise": "upbeat party",
    "excited": "energetic hype",
    "bored": "fresh new music",
    "tired": "relaxing",
    "relaxed": "relaxing chill",
    "stressed": "calm relaxing",
    "anxious": "calm soothing",
    "depressed": "comforting songs",
    "lonely": "comforting songs",
    "energetic": "upbeat energy",
    "nostalgic": "throwback nostalgia",
    "confused": "focus instrumental",
    "frustrated": "rock workout",
    "hopeful": "uplifting",
    "proud": "empowering anthems",
    "content": "chill vibes",
    "amused": "fun feel good",
}
_DEFAULT_QUERY = "popular hits"

# --- token cache ----------------------------------------------------------
_token_lock = threading.Lock()
_token_value: str | None = None
_token_expires_at: float = 0.0


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
            _TOKEN_URL,
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


def _invalidate_token() -> None:
    """Drop the cached token so the next call fetches a fresh one."""
    global _token_value, _token_expires_at
    with _token_lock:
        _token_value = None
        _token_expires_at = 0.0


def _authorized_get(url: str, params: dict) -> dict:
    """GET a Spotify endpoint with the bearer token.

    Refreshes the token once on 401 and backs off once on 429. Raises a
    ``requests.RequestException`` (incl. HTTPError) on a hard failure.
    """
    response = None
    for attempt in (1, 2):
        token = get_spotify_access_token()
        response = requests.get(
            url,
            headers={"Authorization": f"Bearer {token}"},
            params=params,
            timeout=_HTTP_TIMEOUT,
        )
        if attempt == 1 and response.status_code == 401:
            _invalidate_token()
            continue
        if attempt == 1 and response.status_code == 429:
            retry_after = response.headers.get("Retry-After", "1")
            try:
                delay = min(int(retry_after), 5)
            except (TypeError, ValueError):
                delay = 1
            time.sleep(delay)
            continue
        response.raise_for_status()
        return response.json()

    response.raise_for_status()
    return response.json()


def _parse_track(track: dict) -> dict:
    """Normalise a Spotify track object to the app's track shape."""
    images = (track.get("album") or {}).get("images") or []
    artists = ", ".join(a.get("name", "") for a in track.get("artists") or [] if a)
    return {
        "name": track.get("name") or "Unknown track",
        "artist": artists or "Unknown artist",
        "preview_url": track.get("preview_url"),
        "external_url": (track.get("external_urls") or {}).get("spotify"),
        "image_url": images[0].get("url") if images else None,
    }


def _search_playlist_ids(query: str, market: str | None) -> list[str]:
    """Return playlist ids matching a mood query, in random order."""
    params = {"q": query, "type": "playlist", "limit": 20}
    if market:
        params["market"] = market
    data = _authorized_get(_SEARCH_URL, params)
    items = (data.get("playlists") or {}).get("items") or []
    ids = [p["id"] for p in items if p and p.get("id")]
    random.shuffle(ids)
    return ids


def _playlist_track_dicts(playlist_id: str, market: str | None) -> list[dict]:
    """Return parsed, playable tracks from a playlist (episodes excluded)."""
    params = {"limit": 50}
    if market:
        params["market"] = market
    data = _authorized_get(_PLAYLIST_TRACKS_URL.format(playlist_id=playlist_id), params)
    tracks = []
    for item in data.get("items") or []:
        track = (item or {}).get("track")
        if track and track.get("type", "track") == "track" and track.get("name"):
            tracks.append(_parse_track(track))
    return tracks


def _search_track_dicts(query: str, market: str | None) -> list[dict]:
    """Fallback: a plain keyword track search."""
    params = {"q": query, "type": "track", "limit": _RESULT_SIZE}
    if market:
        params["market"] = market
    data = _authorized_get(_SEARCH_URL, params)
    items = (data.get("tracks") or {}).get("items") or []
    return [_parse_track(t) for t in items if t and t.get("name")]


def get_music_recommendation(emotion: str, market: str | None = None) -> list[dict]:
    """Return mood-matched track dicts for the given emotion.

    Returns an empty list on any Spotify failure -- recommendation problems
    must never fail the emotion-detection request.
    """
    if not emotion or not emotion.strip():
        return []

    market = market if (market and len(market) == 2) else None
    query = EMOTION_TO_QUERY.get(emotion.strip().lower(), _DEFAULT_QUERY)

    try:
        # 1. Curated mood playlists -- the primary, mood-accurate path.
        for playlist_id in _search_playlist_ids(query, market):
            try:
                tracks = _playlist_track_dicts(playlist_id, market)
            except requests.RequestException:
                # e.g. a Spotify-owned playlist that is not API-accessible.
                continue
            playable = [t for t in tracks if t["external_url"]]
            if len(playable) >= _MIN_USABLE_TRACKS:
                random.shuffle(playable)
                return playable[:_RESULT_SIZE]

        # 2. Fallback: keyword track search (no playlist matched).
        return _search_track_dicts(query, market)
    except requests.RequestException:
        logger.warning("Spotify request failed for emotion=%s", emotion)
        return []
    except Exception:  # noqa: BLE001 -- e.g. missing-credentials RuntimeError
        logger.exception("Unexpected recommendation error for emotion=%s", emotion)
        return []
