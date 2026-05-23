"""Lightweight personalization model for music recommendations.

When a user has a mood history we want recommendations that reflect both
the moment and their longer-term taste -- without a heavyweight model.
This module does that with three classical, sub-millisecond techniques:

  * a recency-weighted affinity score (exponential smoothing / EWMA) that
    turns the raw mood history into a per-mood taste weight;
  * a first-order Markov chain over the mood sequence that predicts the
    mood the user is trending toward, and boosts it;
  * a linear track scorer that ranks each mood's tracks best-first by
    blending the curated playlist order with Spotify popularity.

The affinity also drives an *adaptive* blend ratio, so a strongly
recurring mood is interleaved often and a faint one only occasionally.
Everything is O(history + tracks) integer/float counting, adding well
under a millisecond per request -- fast enough to run inline on every
recommendation call.
"""

from collections import Counter, defaultdict

# A mood k steps before the latest contributes RECENCY_DECAY**k to the
# affinity score; ~0.85 keeps roughly the last ~10 moods meaningful.
RECENCY_DECAY = 0.85
# Extra affinity granted to the mood the Markov chain predicts comes next.
MARKOV_BOOST = 0.6
# How much Spotify popularity (0-1) sways a track's rank within its mood.
# Small, so the curated playlist order stays the dominant signal.
POPULARITY_WEIGHT = 0.2
# Bounds on the adaptive interleave: 1 recurring track per N current ones.
MIN_BLEND_EVERY = 1
MAX_BLEND_EVERY = 5
# A Markov prediction needs at least this many moods to carry signal.
_MIN_MARKOV_HISTORY = 3


def _norm(mood: str) -> str:
    """Normalise a mood label for use as a dict key."""
    return (mood or "").strip().lower()


def predict_next_mood(moods: list[str]) -> str | None:
    """First-order Markov prediction of the mood after the latest one.

    Builds a transition-count matrix from the (normalised) sequence and
    returns the most likely successor of the last mood. Returns None when
    the sequence is too short, or the last mood has never been a source.
    """
    if len(moods) < _MIN_MARKOV_HISTORY:
        return None
    transitions: dict[str, Counter] = defaultdict(Counter)
    for current, nxt in zip(moods, moods[1:]):
        transitions[current][nxt] += 1
    following = transitions.get(moods[-1])
    return following.most_common(1)[0][0] if following else None


def mood_affinity(current_emotion: str, history: list[str] | None) -> dict[str, float]:
    """Return a recency-weighted taste profile: ``{mood: weight}``.

    The latest moods dominate (exponential decay); the just-detected
    emotion is always represented so the result stays anchored to it; the
    Markov-predicted next mood is boosted so a clear trend is rewarded.
    """
    affinity: dict[str, float] = defaultdict(float)
    affinity[_norm(current_emotion)] += 1.0

    moods = [_norm(m) for m in (history or []) if _norm(m)]
    latest = len(moods) - 1
    for index, mood in enumerate(moods):
        affinity[mood] += RECENCY_DECAY ** (latest - index)

    predicted = predict_next_mood(moods)
    if predicted:
        affinity[predicted] += MARKOV_BOOST

    return dict(affinity)


def recurring_mood(current_emotion: str, affinity: dict[str, float]) -> str | None:
    """The highest-affinity mood that is not the current one (or None)."""
    current = _norm(current_emotion)
    others = {mood: weight for mood, weight in affinity.items() if mood and mood != current}
    return max(others, key=others.get) if others else None


def blend_ratio(current_emotion: str, mood: str, affinity: dict[str, float]) -> int:
    """How many current-mood tracks to show per recurring-mood track.

    Derived from the two moods' relative affinity: a recurring mood about
    as strong as the current one interleaves 1:1; a faint one is rare.
    """
    current = affinity.get(_norm(current_emotion), 1.0) or 1.0
    other = affinity.get(_norm(mood), 0.0)
    if other <= 0:
        return MAX_BLEND_EVERY
    every = round(current / other)
    return max(MIN_BLEND_EVERY, min(MAX_BLEND_EVERY, every))


def rank_by_quality(tracks: list[dict]) -> list[dict]:
    """Order one mood's tracks best-first.

    Score blends the curated playlist position (the dominant signal) with
    Spotify popularity, so a clearly more popular track can rise a little
    while the curated order is otherwise preserved.
    """
    count = len(tracks)
    if count < 2:
        return list(tracks)

    def score(item: tuple[int, dict]) -> float:
        index, track = item
        curated = (count - index) / count  # 1.0 for the first track, ~0 for the last
        popularity = max(0, min(100, int(track.get("popularity") or 0))) / 100.0
        return curated + POPULARITY_WEIGHT * popularity

    return [track for _, track in sorted(enumerate(tracks), key=score, reverse=True)]


def interleave(primary: list[dict], secondary: list[dict], every: int) -> list[dict]:
    """Interleave secondary tracks into primary -- one per ``every`` of them.

    Primary stays the backbone (it matches the just-detected mood); any
    secondary tracks left over are appended. De-duplicated by external_url.
    """
    every = max(1, every)
    seen: set[str] = set()
    out: list[dict] = []

    def add(track: dict) -> None:
        url = track.get("external_url")
        if url and url not in seen:
            seen.add(url)
            out.append(track)

    rest = iter(secondary)
    for index, track in enumerate(primary):
        add(track)
        if index % every == every - 1:
            nxt = next(rest, None)
            if nxt is not None:
                add(nxt)
    for track in rest:
        add(track)
    return out
