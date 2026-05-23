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

import config
from cache import TTLCache

logger = logging.getLogger(__name__)

_SEARCH_URL = "https://api.deezer.com/search"
_HTTP_TIMEOUT = 10

# Module-level cache so repeats inside one container hit RAM instead of
# the Deezer network. Keyed by ``(query, limit)`` -- normalised query in
# ``search_tracks`` -- with the TTL/size pulled from config so prod can
# tune without a code change. The cache stores the *parsed* track list,
# so a hit is essentially free (just a dict copy).
_search_cache = TTLCache(
    max_size=config.CACHE_DEEZER_MAX,
    ttl_seconds=config.CACHE_DEEZER_TTL,
    name="deezer_search",
)


def get_cache() -> TTLCache:
    """Expose the cache for /health observability and tests."""
    return _search_cache


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

    Repeated calls with the same query+limit within the cache TTL are
    served from RAM (no Deezer round trip). Empty results are NOT cached
    so a transient upstream failure isn't memoised; the next call retries.

    Returns an empty list on any failure (network, malformed JSON) so the
    caller can fall through to the curated static list without having to
    catch this module's exceptions itself.
    """
    cache_key = ((query or "").strip().lower(), int(limit))
    cached = _search_cache.get(cache_key)
    if cached is not None:
        # Hand back a fresh copy so the caller can mutate (sort / slice /
        # personalise) without mutating the cached entry.
        return [dict(track) for track in cached]

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
    parsed = [track for track in (_parse_track(item) for item in items) if track is not None]
    if parsed:
        # Only cache non-empty results -- never memoise an outage.
        _search_cache.set(cache_key, [dict(track) for track in parsed])
    return parsed
