"""Spotify-backed music recommendation.

Recommendations are built from *curated mood playlists*: for a detected
emotion we search Spotify for matching playlists and collect tracks from
them. This produces genuinely mood-matched results -- far better than a
plain keyword track search.

A large set (up to _MAX_RESULTS) is returned so the client can paginate
and sort it; each track carries popularity / release-date / duration so
the client can offer meaningful sort orders. Results are de-duplicated
and kept in the playlists' curated order (that order is the "Recommended"
sort on the client).

This deliberately does NOT use Spotify's ``/v1/recommendations`` or
audio-features endpoints -- Spotify deprecated those (Nov 2024). Playlist
search + playlist tracks are core, still-supported endpoints. A keyword
track search is the first fallback; a curated static list is the last
resort, so a non-empty result is *always* returned.
"""

import base64
import logging
import random
import threading
import time
import urllib.parse

import requests

import config

logger = logging.getLogger(__name__)

_TOKEN_URL = "https://accounts.spotify.com/api/token"
_SEARCH_URL = "https://api.spotify.com/v1/search"
_PLAYLIST_TRACKS_URL = "https://api.spotify.com/v1/playlists/{playlist_id}/tracks"
_HTTP_TIMEOUT = 10

_MAX_RESULTS = 60          # upper bound on tracks returned (client paginates)
_MIN_USABLE_TRACKS = 4     # minimum before the playlist path is accepted
_PLAYLIST_PAGE = 50        # tracks fetched per playlist

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

# Last-resort recommendations, used only when Spotify is unreachable or
# returns nothing. Curated, broadly-loved tracks; the external_url is a
# Spotify search link so it always resolves even without a track id.
_FALLBACK_TRACKS = [
    {"name": "Blinding Lights", "artist": "The Weeknd"},
    {"name": "Levitating", "artist": "Dua Lipa"},
    {"name": "As It Was", "artist": "Harry Styles"},
    {"name": "good 4 u", "artist": "Olivia Rodrigo"},
    {"name": "Sunflower", "artist": "Post Malone, Swae Lee"},
    {"name": "Uptown Funk", "artist": "Mark Ronson, Bruno Mars"},
    {"name": "Someone Like You", "artist": "Adele"},
    {"name": "Counting Stars", "artist": "OneRepublic"},
    {"name": "Stay", "artist": "The Kid LAROI, Justin Bieber"},
    {"name": "Shape of You", "artist": "Ed Sheeran"},
    {"name": "Believer", "artist": "Imagine Dragons"},
    {"name": "Riptide", "artist": "Vance Joy"},
    {"name": "Heat Waves", "artist": "Glass Animals"},
    {"name": "Don't Start Now", "artist": "Dua Lipa"},
]

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
    """Normalise a Spotify track object to the app's track shape.

    Includes popularity / release date / duration so the client can sort.
    """
    album = track.get("album") or {}
    images = album.get("images") or []
    artists = ", ".join(a.get("name", "") for a in track.get("artists") or [] if a)
    return {
        "name": track.get("name") or "Unknown track",
        "artist": artists or "Unknown artist",
        "album": album.get("name"),
        "preview_url": track.get("preview_url"),
        "external_url": (track.get("external_urls") or {}).get("spotify"),
        "image_url": images[0].get("url") if images else None,
        "popularity": int(track.get("popularity") or 0),
        "duration_ms": int(track.get("duration_ms") or 0),
        "release_date": album.get("release_date"),
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
    params = {"limit": _PLAYLIST_PAGE}
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
    params = {"q": query, "type": "track", "limit": _PLAYLIST_PAGE}
    if market:
        params["market"] = market
    data = _authorized_get(_SEARCH_URL, params)
    items = (data.get("tracks") or {}).get("items") or []
    return [_parse_track(t) for t in items if t and t.get("name")]


def _fallback_recommendations() -> list[dict]:
    """A non-empty, curated recommendation set for when Spotify fails."""
    tracks = list(_FALLBACK_TRACKS)
    random.shuffle(tracks)
    return [
        {
            "name": t["name"],
            "artist": t["artist"],
            "album": None,
            "preview_url": None,
            "external_url": "https://open.spotify.com/search/"
            + urllib.parse.quote(f"{t['name']} {t['artist']}"),
            "image_url": None,
            "popularity": 0,
            "duration_ms": 0,
            "release_date": None,
        }
        for t in tracks
    ]


def get_music_recommendation(emotion: str, market: str | None = None) -> list[dict]:
    """Return mood-matched tracks for the given emotion.

    Returns up to _MAX_RESULTS de-duplicated tracks in curated order. The
    list is ALWAYS non-empty: on any Spotify failure it returns a curated
    fallback set, so a caller never surfaces an error or an empty result.
    """
    market = market if (market and len(market) == 2) else None
    query = EMOTION_TO_QUERY.get((emotion or "").strip().lower(), _DEFAULT_QUERY)

    try:
        # 1. Collect tracks from curated mood playlists.
        collected: list[dict] = []
        seen: set[str] = set()
        for playlist_id in _search_playlist_ids(query, market):
            try:
                tracks = _playlist_track_dicts(playlist_id, market)
            except requests.RequestException:
                continue  # e.g. a Spotify-owned playlist that is not accessible
            for track in tracks:
                url = track.get("external_url")
                if url and url not in seen:
                    seen.add(url)
                    collected.append(track)
            if len(collected) >= _MAX_RESULTS:
                break
        if len(collected) >= _MIN_USABLE_TRACKS:
            return collected[:_MAX_RESULTS]

        # 2. Keyword track search (no playlist matched).
        tracks = _search_track_dicts(query, market)
        if tracks:
            return tracks[:_MAX_RESULTS]
    except requests.RequestException:
        logger.warning("Spotify request failed for emotion=%s", emotion)
    except Exception:  # noqa: BLE001 -- e.g. missing-credentials RuntimeError
        logger.exception("Unexpected recommendation error for emotion=%s", emotion)

    # 3. Last resort -- always hand back something listenable.
    return _fallback_recommendations()
