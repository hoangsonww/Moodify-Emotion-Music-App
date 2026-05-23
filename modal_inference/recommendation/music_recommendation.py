"""Deezer-backed music recommendation.

For a detected emotion we collect tracks via a Deezer keyword search and
return up to _MAX_RESULTS de-duplicated results so the client can
paginate and sort them. Each track carries popularity / duration so the
client can offer meaningful sort orders.

Sourcing strategy, in order of preference:

  1. Deezer search for the mood query (free, keyless, rich metadata --
     30s preview, album cover, popularity rank, Deezer track URL).
  2. Curated static list, last resort when Deezer is unreachable so a
     non-empty result is *always* returned.

Spotify is intentionally NOT used: Spotify locked down /v1/search for
client-credentials apps (every request 403s), making it unusable here.
"""

import logging
import random
import urllib.parse

import requests

from recommendation import deezer, personalization

logger = logging.getLogger(__name__)

_MAX_RESULTS = 60          # upper bound on tracks returned (client paginates)
_MIN_USABLE_TRACKS = 4     # minimum before a live result is preferred to the fallback
_SEARCH_LIMIT = 50         # tracks fetched per Deezer search call
_HISTORY_BLEND_LIMIT = 30  # cap on recurring-mood tracks fetched (bounds latency)

# Detected emotion -> a search phrase that surfaces mood-matched tracks.
# Covers every label the text, speech and facial models emit, plus common
# synonyms; anything unmapped falls back to _DEFAULT_QUERY.
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

# Last-resort recommendations, used only when Deezer is unreachable or
# returns nothing. Curated, broadly-loved tracks; the external_url is a
# Deezer search link so it always resolves even without a track id.
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


def _fallback_recommendations() -> list[dict]:
    """A non-empty, curated recommendation set for when Deezer fails."""
    tracks = list(_FALLBACK_TRACKS)
    random.shuffle(tracks)
    return [
        {
            "name": track["name"],
            "artist": track["artist"],
            "album": None,
            "preview_url": None,
            "external_url": "https://www.deezer.com/search/"
            + urllib.parse.quote(f"{track['name']} {track['artist']}"),
            "image_url": None,
            "popularity": 0,
            "duration_ms": 0,
            "release_date": None,
        }
        for track in tracks
    ]


def _query_for(emotion: str) -> str:
    """Map a detected emotion to its mood-keyword search phrase."""
    return EMOTION_TO_QUERY.get((emotion or "").strip().lower(), _DEFAULT_QUERY)


def _query_with_genre(base: str, genre: str | None) -> str:
    """Prepend an optional genre keyword so Deezer skews toward that genre.

    Empty / whitespace-only genres are ignored and the original mood query
    is returned untouched, so callers can pass through user input without
    pre-validating.
    """
    g = (genre or "").strip().lower()
    if not g:
        return base
    # Deezer's search ranks keyword hits across track + artist + album, so
    # putting the genre first ("hip-hop happy feel good") is enough to bias
    # the results without losing the mood phrase.
    return f"{g} {base}"


def _collect_for_query(query: str, limit: int = _MAX_RESULTS) -> list[dict]:
    """Return up to ``limit`` Deezer search hits for ``query`` (may be empty)."""
    tracks = deezer.search_tracks(query, limit=min(limit, _SEARCH_LIMIT))
    return tracks[:limit]


def _personalize(
    emotion: str,
    history: list[str],
    primary: list[dict],
    genre: str | None = None,
) -> list[dict]:
    """Blend the user's recurring mood into ``primary`` via the model.

    The lightweight personalization model (recommendation/personalization)
    turns the mood history into a taste profile, picks the recurring mood,
    fetches its tracks, and interleaves them at an affinity-driven rate.
    Both mood sets are quality-ranked first so their best tracks surface.

    Fetching the recurring-mood tracks is best-effort -- the Deezer client
    swallows network errors and returns [], so a failure there just skips
    the blend instead of sinking the primary result.
    """
    affinity = personalization.mood_affinity(emotion, history)
    recurring = personalization.recurring_mood(emotion, affinity)

    # No distinct recurring taste (or it maps to the same search phrase as
    # the current mood) -- nothing to blend, just quality-rank what we have.
    if not recurring or _query_for(recurring) == _query_for(emotion):
        return personalization.rank_by_quality(primary)

    secondary = _collect_for_query(
        _query_with_genre(_query_for(recurring), genre),
        limit=_HISTORY_BLEND_LIMIT,
    )
    if not secondary:
        return personalization.rank_by_quality(primary)

    every = personalization.blend_ratio(emotion, recurring, affinity)
    return personalization.interleave(
        personalization.rank_by_quality(primary),
        personalization.rank_by_quality(secondary),
        every,
    )


def get_music_recommendation(
    emotion: str,
    market: str | None = None,
    history: list[str] | None = None,
    genre: str | None = None,
) -> list[dict]:
    """Return mood-matched tracks for the given emotion.

    When ``history`` (recent detected moods) is supplied, a lightweight
    personalization model blends in tracks for the user's recurring mood
    and quality-ranks the result, so recommendations reflect both the
    moment and the longer-term pattern. Without history the live result
    order is returned unchanged.

    When ``genre`` (e.g. "hip-hop", "lofi") is supplied, it is prepended
    to the Deezer search phrase so the result skews toward that genre.
    Both the primary search and the personalization blend share the genre
    bias so the mix stays coherent.

    The ``market`` argument is accepted for API compatibility with the
    previous Spotify path but is unused -- Deezer's search endpoint does
    not take a market.

    Returns up to _MAX_RESULTS de-duplicated tracks. The list is ALWAYS
    non-empty: on any Deezer failure it returns a curated fallback set,
    so a caller never surfaces an error or an empty result.
    """
    del market  # noqa -- interface parity only

    try:
        primary_query = _query_with_genre(_query_for(emotion), genre)
        primary = _collect_for_query(primary_query)

        if history:
            primary = _personalize(emotion, history, primary, genre)

        if len(primary) >= _MIN_USABLE_TRACKS:
            return primary[:_MAX_RESULTS]
        if primary:
            return primary
    except requests.RequestException as exc:
        # Defensive: the Deezer client already swallows RequestException
        # internally, but personalize() could in principle raise a new one.
        logger.warning("Live recommendation failed for emotion=%s: %s", emotion, exc)
    except Exception:  # noqa: BLE001
        logger.exception("Unexpected recommendation error for emotion=%s", emotion)

    # Last resort -- always hand back something listenable.
    return _fallback_recommendations()
