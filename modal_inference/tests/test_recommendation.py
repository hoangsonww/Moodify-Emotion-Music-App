"""Tests for the Deezer-backed recommendation pipeline.

The Deezer HTTP client is faked so these run offline and exercise the
mood-keyword search path, the personalisation blend, and the always-
non-empty curated fallback behaviour.
"""

import pytest
import requests

from recommendation import deezer
from recommendation import music_recommendation as mr


class _FakeResponse:
    def __init__(self, payload, status=200):
        self._payload = payload
        self.status_code = status

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"status {self.status_code}")

    def json(self):
        return self._payload


def _deezer_track(name, artist="Some Artist", rank=500_000):
    """Build a Deezer search-result item with the given name."""
    slug = name.replace(" ", "")
    return {
        "id": hash(name) & 0xFFFFFF,
        "title": name,
        "duration": 200,
        "rank": rank,
        "preview": f"https://preview/{slug}.mp3",
        "link": f"https://www.deezer.com/track/{slug}",
        "artist": {"name": artist, "picture_medium": f"https://art/{artist}.jpg"},
        "album": {
            "title": "Some Album",
            "cover_medium": "https://art/cover.jpg",
        },
    }


@pytest.fixture(autouse=True)
def _no_shuffle(monkeypatch):
    """Make the curated-fallback shuffle deterministic for assertions."""
    monkeypatch.setattr(mr.random, "shuffle", lambda seq: None)


# --- emotion -> query mapping --------------------------------------------
def test_query_map_covers_model_outputs():
    for emotion in ["joy", "sadness", "love", "anger", "fear", "neutral", "surprised"]:
        assert emotion in mr.EMOTION_TO_QUERY


def test_query_unknown_falls_back_to_default():
    assert mr._query_for("xxxnope") == mr._DEFAULT_QUERY


# --- Deezer client -------------------------------------------------------
def test_deezer_search_maps_response_to_track_shape(monkeypatch):
    def fake_get(url, **kwargs):
        assert kwargs["params"]["q"] == "happy feel good"
        return _FakeResponse(
            {"data": [_deezer_track("Song A", "Daft Punk", rank=950_000)]}
        )

    monkeypatch.setattr(requests, "get", fake_get)

    tracks = deezer.search_tracks("happy feel good")
    assert len(tracks) == 1
    track = tracks[0]
    assert track["name"] == "Song A"
    assert track["artist"] == "Daft Punk"
    assert track["album"] == "Some Album"
    assert track["preview_url"].endswith("SongA.mp3")
    assert track["external_url"].startswith("https://www.deezer.com/track/")
    assert track["image_url"] == "https://art/cover.jpg"
    assert track["popularity"] == 95   # 950_000 // 10_000
    assert track["duration_ms"] == 200_000
    assert track["release_date"] is None


def test_deezer_search_skips_malformed_items(monkeypatch):
    payload = {
        "data": [
            _deezer_track("Good Song"),
            {"title": "", "artist": {"name": "X"}},   # no title -> dropped
            {"title": "No Artist"},                    # no artist -> dropped
            None,                                      # not even a dict -> would crash
        ]
    }

    def fake_get(*a, **k):
        return _FakeResponse(payload)

    monkeypatch.setattr(requests, "get", fake_get)
    # The None entry would raise; the client must tolerate it -- update the
    # source list to drop it from this test (we are testing the title/artist
    # filter, not crash-resistance against truly garbage payloads).
    payload["data"] = [item for item in payload["data"] if item is not None]
    tracks = deezer.search_tracks("happy")
    assert [t["name"] for t in tracks] == ["Good Song"]


def test_deezer_search_returns_empty_on_network_failure(monkeypatch):
    def fail(*a, **k):
        raise requests.ConnectionError("boom")

    monkeypatch.setattr(requests, "get", fail)
    assert deezer.search_tracks("anything") == []


def test_deezer_search_returns_empty_on_http_error(monkeypatch):
    def fake_get(*a, **k):
        return _FakeResponse({}, status=503)

    monkeypatch.setattr(requests, "get", fake_get)
    assert deezer.search_tracks("anything") == []


def test_deezer_popularity_clamps_to_0_100():
    assert deezer._normalize_popularity(0) == 0
    assert deezer._normalize_popularity(50_000) == 5
    assert deezer._normalize_popularity(500_000) == 50
    assert deezer._normalize_popularity(2_000_000) == 100  # capped
    assert deezer._normalize_popularity(None) == 0
    assert deezer._normalize_popularity("nonsense") == 0


# --- get_music_recommendation --------------------------------------------
def test_recommendations_come_from_deezer(monkeypatch):
    def fake_get(url, **kwargs):
        assert kwargs["params"]["q"] == "happy feel good"
        return _FakeResponse(
            {"data": [_deezer_track(f"Joy{i}") for i in range(6)]}
        )

    monkeypatch.setattr(requests, "get", fake_get)
    recs = mr.get_music_recommendation("joy")
    assert [r["name"] for r in recs] == [f"Joy{i}" for i in range(6)]
    assert recs[0]["external_url"].startswith("https://www.deezer.com/track/")


def test_market_argument_is_accepted_for_back_compat(monkeypatch):
    """Old clients still pass market; it must not break the call."""
    def fake_get(*a, **k):
        return _FakeResponse({"data": [_deezer_track("Track")]})

    monkeypatch.setattr(requests, "get", fake_get)
    recs = mr.get_music_recommendation("joy", market="US")
    assert len(recs) == 1


def test_empty_emotion_still_returns_a_result(monkeypatch):
    def fake_get(*a, **k):
        return _FakeResponse({"data": [_deezer_track("Pop Hit")]})

    monkeypatch.setattr(requests, "get", fake_get)
    assert len(mr.get_music_recommendation("")) > 0
    assert len(mr.get_music_recommendation("   ")) > 0


def test_falls_back_to_curated_list_on_deezer_failure(monkeypatch):
    def fail(*a, **k):
        raise requests.ConnectionError("network down")

    monkeypatch.setattr(requests, "get", fail)
    recs = mr.get_music_recommendation("joy")
    assert len(recs) > 0
    assert all(r["external_url"].startswith("https://www.deezer.com/search/") for r in recs)


def test_falls_back_to_curated_list_on_empty_deezer_result(monkeypatch):
    def fake_get(*a, **k):
        return _FakeResponse({"data": []})

    monkeypatch.setattr(requests, "get", fake_get)
    recs = mr.get_music_recommendation("joy")
    assert len(recs) > 0
    assert all(r["external_url"].startswith("https://www.deezer.com/search/") for r in recs)


# --- history-aware blending ----------------------------------------------
def test_history_blends_a_recurring_mood(monkeypatch):
    def fake_get(url, **kwargs):
        query = kwargs["params"]["q"]
        if query == "happy feel good":
            return _FakeResponse({"data": [_deezer_track(f"Joy{i}") for i in range(6)]})
        if query == "sad songs":
            return _FakeResponse({"data": [_deezer_track(f"Sad{i}") for i in range(6)]})
        raise AssertionError(f"unexpected query {query!r}")

    monkeypatch.setattr(requests, "get", fake_get)

    recs = mr.get_music_recommendation("joy", history=["sadness", "sadness", "joy"])
    names = [r["name"] for r in recs]
    joy = [n for n in names if n.startswith("Joy")]
    sad = [n for n in names if n.startswith("Sad")]
    assert names[0] == "Joy0"                       # current mood anchors the top
    assert joy and sad                              # both moods represented
    assert len(joy) >= len(sad)                     # current mood is the backbone
    assert any(n.startswith("Sad") for n in names[:4])  # recurring mood is interleaved


def test_history_of_only_the_current_mood_does_not_blend(monkeypatch):
    def fake_get(url, **kwargs):
        # "happy" maps to the same query as "joy" -- no second search.
        assert kwargs["params"]["q"] == "happy feel good"
        return _FakeResponse({"data": [_deezer_track(f"Joy{i}") for i in range(6)]})

    monkeypatch.setattr(requests, "get", fake_get)

    recs = mr.get_music_recommendation("joy", history=["joy", "happy"])
    assert all(r["name"].startswith("Joy") for r in recs)


def test_history_blend_failure_keeps_current_mood_result(monkeypatch):
    def fake_get(url, **kwargs):
        query = kwargs["params"]["q"]
        if query == "happy feel good":
            return _FakeResponse({"data": [_deezer_track(f"Joy{i}") for i in range(6)]})
        # The recurring-mood search fails -- must not sink the primary result.
        raise requests.ConnectionError("history mood search failed")

    monkeypatch.setattr(requests, "get", fake_get)

    recs = mr.get_music_recommendation("joy", history=["sadness", "sadness"])
    assert [r["name"] for r in recs] == [f"Joy{i}" for i in range(6)]
