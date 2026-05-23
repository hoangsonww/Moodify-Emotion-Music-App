"""Deezer-backed track search.

Free, keyless music source -- no developer dashboard, no OAuth flow, no
rate-limit theatre. Replaces the Spotify search endpoints, which Spotify
locked down for client-credentials apps (every request returns 403).

The response is mapped into the same track shape the rest of the
recommender uses, so ``get_music_recommendation`` does not need to know
where its tracks came from.
"""

import logging

import requests

logger = logging.getLogger(__name__)

_SEARCH_URL = "https://api.deezer.com/search"
_HTTP_TIMEOUT = 10


def _normalize_popularity(rank) -> int:
    """Deezer ``rank`` is on a 0..~1,000,000 scale -- compress to 0-100.

    A rank around 1M corresponds to a present-day chart hit; 100k to a
    well-known back-catalogue track. Anything obscure is comfortably
    below 50 on the normalised scale.
    """
    try:
        value = int(rank or 0)
    except (TypeError, ValueError):
        return 0
    return max(0, min(100, value // 10_000))


def _parse_track(item: dict) -> dict | None:
    """Map one Deezer search-result item to the app's track shape.

    Returns ``None`` for malformed entries (no title or artist) so the
    caller can drop them. ``release_date`` is not present on the search
    endpoint -- fetching it would require a per-track /album/{id} call;
    we accept losing the "newest" sort rather than 50x the latency.
    """
    title = item.get("title")
    artist = (item.get("artist") or {}).get("name")
    if not title or not artist:
        return None
    album = item.get("album") or {}
    return {
        "name": title,
        "artist": artist,
        "album": album.get("title"),
        "preview_url": item.get("preview"),
        # Deezer track page -- works in the browser without an account
        # for the 30s preview; signs in for the full track.
        "external_url": item.get("link"),
        "image_url": album.get("cover_medium") or album.get("cover"),
        "popularity": _normalize_popularity(item.get("rank")),
        "duration_ms": int(item.get("duration") or 0) * 1000,
        "release_date": None,
    }


def search_tracks(query: str, limit: int = 50) -> list[dict]:
    """Return up to ``limit`` Deezer search hits, mapped to track dicts.

    Returns an empty list on any failure (network, malformed JSON) so the
    caller can fall through to the curated static list without having to
    catch this module's exceptions itself.
    """
    try:
        resp = requests.get(
            _SEARCH_URL,
            params={"q": query, "limit": limit},
            timeout=_HTTP_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
    except (requests.RequestException, ValueError) as exc:
        logger.warning("Deezer search failed for query=%r: %s", query, exc)
        return []

    items = data.get("data") or []
    parsed = (_parse_track(item) for item in items)
    return [track for track in parsed if track is not None]
