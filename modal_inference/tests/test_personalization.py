"""Tests for the lightweight personalization model (recommendation/).

These exercise the recency-weighted affinity (EWMA), the first-order
Markov next-mood predictor, the adaptive blend ratio, the quality
ranker, and the interleave -- all offline, no Spotify involved.
"""

from recommendation import personalization as p


def _tracks(prefix, n, popularity=50):
    return [
        {
            "name": f"{prefix}{i}",
            "external_url": f"url://{prefix}{i}",
            "popularity": popularity,
        }
        for i in range(n)
    ]


# --- Markov next-mood prediction ------------------------------------------
def test_predict_next_mood_needs_enough_history():
    assert p.predict_next_mood([]) is None
    assert p.predict_next_mood(["joy", "joy"]) is None


def test_predict_next_mood_picks_most_common_successor():
    # joy is always followed by sad; the latest mood is joy.
    assert p.predict_next_mood(["joy", "sad", "joy", "sad", "joy"]) == "sad"


def test_predict_next_mood_none_when_last_mood_is_an_unseen_source():
    # "calm" only ever appears last, so it has no recorded transitions.
    assert p.predict_next_mood(["joy", "sad", "joy", "calm"]) is None


# --- recency-weighted affinity --------------------------------------------
def test_affinity_always_includes_the_current_emotion():
    assert p.mood_affinity("joy", [])["joy"] == 1.0


def test_affinity_weights_recent_moods_higher():
    # Each mood occurs once; "calm" is more recent than "sad".
    aff = p.mood_affinity("joy", ["sad", "calm"])
    assert aff["calm"] > aff["sad"]


def test_affinity_normalises_mood_casing_and_whitespace():
    aff = p.mood_affinity("Joy", ["  SAD ", "sad"])
    assert "joy" in aff and "sad" in aff


def test_affinity_boosts_the_markov_predicted_mood():
    # joy -> sad every time, so sad is the predicted next mood and is
    # boosted beyond its plain recency weight.
    history = ["joy", "sad", "joy", "sad", "joy"]
    boosted = p.mood_affinity("joy", history)["sad"]
    plain = sum(p.RECENCY_DECAY ** k for k in (1, 3))  # sad sits at indexes 1 and 3
    assert boosted > plain


# --- recurring mood --------------------------------------------------------
def test_recurring_mood_excludes_the_current_emotion():
    aff = p.mood_affinity("joy", ["sad", "sad", "sad"])
    assert p.recurring_mood("joy", aff) == "sad"


def test_recurring_mood_is_none_without_other_moods():
    aff = p.mood_affinity("joy", ["joy", "joy"])
    assert p.recurring_mood("joy", aff) is None


# --- adaptive blend ratio --------------------------------------------------
def test_blend_ratio_is_dense_for_a_strong_recurring_mood():
    aff = p.mood_affinity("joy", ["sad"] * 8)
    assert p.blend_ratio("joy", "sad", aff) <= 2


def test_blend_ratio_is_sparse_for_a_faint_recurring_mood():
    aff = p.mood_affinity("joy", ["joy", "joy", "joy", "sad"])
    assert p.blend_ratio("joy", "sad", aff) >= 3


def test_blend_ratio_stays_within_bounds():
    assert p.blend_ratio("joy", "sad", {"joy": 100.0, "sad": 0.001}) == p.MAX_BLEND_EVERY
    assert p.blend_ratio("joy", "sad", {"joy": 1.0, "sad": 0.0}) == p.MAX_BLEND_EVERY


# --- quality ranking -------------------------------------------------------
def test_rank_by_quality_keeps_curated_order_when_popularity_is_equal():
    tracks = _tracks("T", 5, popularity=50)
    assert [t["name"] for t in p.rank_by_quality(tracks)] == [f"T{i}" for i in range(5)]


def test_rank_by_quality_lifts_a_much_more_popular_track():
    tracks = _tracks("T", 20, popularity=0)
    tracks[19]["popularity"] = 100  # the last track is a smash hit
    ranked = [t["name"] for t in p.rank_by_quality(tracks)]
    assert ranked[0] == "T0"         # curated order still dominates the top
    assert ranked.index("T19") < 19  # but the hit rises from the bottom


def test_rank_by_quality_handles_short_lists():
    assert p.rank_by_quality([]) == []
    one = _tracks("T", 1)
    assert p.rank_by_quality(one) == one


# --- interleave ------------------------------------------------------------
def test_interleave_inserts_one_secondary_per_every():
    out = [t["name"] for t in p.interleave(_tracks("P", 6), _tracks("S", 6), every=2)]
    assert out[:6] == ["P0", "P1", "S0", "P2", "P3", "S1"]


def test_interleave_appends_leftover_secondary():
    out = [t["name"] for t in p.interleave(_tracks("P", 2), _tracks("S", 4), every=2)]
    assert out == ["P0", "P1", "S0", "S1", "S2", "S3"]


def test_interleave_dedupes_by_external_url():
    primary = _tracks("P", 3)
    duplicate = dict(primary[0])  # shares P0's external_url
    out = p.interleave(primary, [duplicate], every=1)
    urls = [t["external_url"] for t in out]
    assert urls.count(primary[0]["external_url"]) == 1
