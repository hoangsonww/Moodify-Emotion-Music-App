"""Tests for the Spotify recommendation client (recommendation/).

Spotify HTTP calls are faked, so these run offline and exercise the
playlist-based recommendation logic, the token cache, and the 401/429
retry behaviour.
"""

import pytest
import requests

from recommendation import music_recommendation as mr


class _FakeResponse:
    def __init__(self, payload, status=200, headers=None):
        self._payload = payload
        self.status_code = status
        self.headers = headers or {}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"status {self.status_code}")

    def json(self):
        return self._payload


def _track(name, popularity=50):
    # A unique external_url per track so de-duplication keeps them all.
    slug = name.replace(" ", "")
    return {
        "name": name,
        "type": "track",
        "artists": [{"name": "Some Artist"}],
        "preview_url": None,
        "external_urls": {"spotify": f"https://open.spotify.com/track/{slug}"},
        "album": {
            "name": "An Album",
            "images": [{"url": "https://img/cover.jpg"}],
            "release_date": "2021-05-01",
        },
        "popularity": popularity,
        "duration_ms": 200000,
    }


def _token_response(*args, **kwargs):
    return _FakeResponse({"access_token": "tok", "expires_in": 3600})


@pytest.fixture(autouse=True)
def _setup(monkeypatch):
    """Reset the token cache, provide credentials, make shuffling a no-op."""
    monkeypatch.setattr(mr, "_token_value", None, raising=False)
    monkeypatch.setattr(mr, "_token_expires_at", 0.0, raising=False)
    monkeypatch.setenv("SPOTIFY_CLIENT_ID", "id")
    monkeypatch.setenv("SPOTIFY_CLIENT_SECRET", "secret")
    monkeypatch.setattr(mr.random, "shuffle", lambda seq: None)


# --- token ----------------------------------------------------------------
def test_access_token_is_cached(monkeypatch):
    calls = {"n": 0}

    def fake_post(*a, **k):
        calls["n"] += 1
        return _token_response()

    monkeypatch.setattr(requests, "post", fake_post)
    assert mr.get_spotify_access_token() == "tok"
    assert mr.get_spotify_access_token() == "tok"
    assert calls["n"] == 1  # second call served from cache


def test_emotion_query_map_covers_model_outputs():
    for emotion in ["joy", "sadness", "love", "anger", "fear", "neutral", "surprised"]:
        assert emotion in mr.EMOTION_TO_QUERY


# --- playlist-based recommendation ---------------------------------------
def test_recommendations_come_from_a_playlist(monkeypatch):
    monkeypatch.setattr(requests, "post", _token_response)

    def fake_get(url, **kwargs):
        params = kwargs.get("params", {})
        if "/search" in url and params.get("type") == "playlist":
            return _FakeResponse({"playlists": {"items": [{"id": "pl_user"}]}})
        if "/playlists/pl_user/tracks" in url:
            return _FakeResponse(
                {
                    "items": [
                        {"track": _track("Song A")},
                        {"track": None},  # removed track -> skipped
                        {"track": {"type": "episode", "name": "A Podcast"}},  # skipped
                        {"track": _track("Song B")},
                        {"track": _track("Song C")},
                        {"track": _track("Song D")},
                        {"track": _track("Song E")},
                    ]
                }
            )
        raise AssertionError(f"unexpected GET {url}")

    monkeypatch.setattr(requests, "get", fake_get)

    recs = mr.get_music_recommendation("joy")
    names = {r["name"] for r in recs}
    assert names == {"Song A", "Song B", "Song C", "Song D", "Song E"}
    assert all(r["external_url"] for r in recs)
    assert recs[0]["artist"] == "Some Artist"
    assert recs[0]["image_url"] == "https://img/cover.jpg"
    # sort metadata flows through for the client
    assert recs[0]["popularity"] == 50
    assert recs[0]["release_date"] == "2021-05-01"
    assert recs[0]["album"] == "An Album"


def test_skips_playlists_that_are_not_accessible(monkeypatch):
    monkeypatch.setattr(requests, "post", _token_response)

    def fake_get(url, **kwargs):
        params = kwargs.get("params", {})
        if "/search" in url and params.get("type") == "playlist":
            return _FakeResponse(
                {"playlists": {"items": [{"id": "spotify_owned"}, {"id": "user_made"}]}}
            )
        if "/playlists/spotify_owned/tracks" in url:
            return _FakeResponse({}, status=404)  # inaccessible -> skipped
        if "/playlists/user_made/tracks" in url:
            return _FakeResponse({"items": [{"track": _track(f"S{i}")} for i in range(6)]})
        raise AssertionError(f"unexpected GET {url}")

    monkeypatch.setattr(requests, "get", fake_get)

    recs = mr.get_music_recommendation("sadness")
    assert len(recs) == 6


def test_falls_back_to_track_search_when_no_playlist_matches(monkeypatch):
    monkeypatch.setattr(requests, "post", _token_response)

    def fake_get(url, **kwargs):
        params = kwargs.get("params", {})
        if "/search" in url and params.get("type") == "playlist":
            return _FakeResponse({"playlists": {"items": []}})  # nothing found
        if "/search" in url and params.get("type") == "track":
            return _FakeResponse({"tracks": {"items": [_track("Fallback Hit")]}})
        raise AssertionError(f"unexpected GET {url}")

    monkeypatch.setattr(requests, "get", fake_get)

    recs = mr.get_music_recommendation("anger")
    assert [r["name"] for r in recs] == ["Fallback Hit"]


def test_refreshes_token_and_retries_on_401(monkeypatch):
    monkeypatch.setattr(requests, "post", _token_response)
    calls = {"playlist_search": 0}

    def fake_get(url, **kwargs):
        params = kwargs.get("params", {})
        if "/search" in url and params.get("type") == "playlist":
            calls["playlist_search"] += 1
            if calls["playlist_search"] == 1:
                return _FakeResponse({}, status=401)  # stale token
            return _FakeResponse({"playlists": {"items": [{"id": "pl"}]}})
        if "/playlists/pl/tracks" in url:
            return _FakeResponse({"items": [{"track": _track(f"T{i}")} for i in range(5)]})
        raise AssertionError(f"unexpected GET {url}")

    monkeypatch.setattr(requests, "get", fake_get)

    recs = mr.get_music_recommendation("calm")
    assert len(recs) == 5
    assert calls["playlist_search"] == 2  # 401 -> refresh -> retry


# --- history-aware blending ----------------------------------------------
def test_history_blends_a_recurring_mood(monkeypatch):
    monkeypatch.setattr(requests, "post", _token_response)

    def fake_get(url, **kwargs):
        params = kwargs.get("params", {})
        query = params.get("q", "")
        if "/search" in url and params.get("type") == "playlist":
            if query == "happy feel good":
                return _FakeResponse({"playlists": {"items": [{"id": "joy_pl"}]}})
            if query == "sad songs":
                return _FakeResponse({"playlists": {"items": [{"id": "sad_pl"}]}})
            return _FakeResponse({"playlists": {"items": []}})
        if "/playlists/joy_pl/tracks" in url:
            return _FakeResponse({"items": [{"track": _track(f"Joy{i}")} for i in range(6)]})
        if "/playlists/sad_pl/tracks" in url:
            return _FakeResponse({"items": [{"track": _track(f"Sad{i}")} for i in range(6)]})
        raise AssertionError(f"unexpected GET {url}")

    monkeypatch.setattr(requests, "get", fake_get)

    recs = mr.get_music_recommendation("joy", history=["sadness", "sadness", "joy"])
    names = [r["name"] for r in recs]
    # The current mood stays the backbone; the recurring mood is interleaved.
    assert names[:5] == ["Joy0", "Joy1", "Sad0", "Joy2", "Joy3"]
    assert {n for n in names if n.startswith("Sad")}  # recurring mood present


def test_history_of_only_the_current_mood_does_not_blend(monkeypatch):
    monkeypatch.setattr(requests, "post", _token_response)

    def fake_get(url, **kwargs):
        params = kwargs.get("params", {})
        if "/search" in url and params.get("type") == "playlist":
            # "happy" maps to the same query as "joy" -- no second search.
            assert params.get("q") == "happy feel good"
            return _FakeResponse({"playlists": {"items": [{"id": "joy_pl"}]}})
        if "/playlists/joy_pl/tracks" in url:
            return _FakeResponse({"items": [{"track": _track(f"Joy{i}")} for i in range(6)]})
        raise AssertionError(f"unexpected GET {url}")

    monkeypatch.setattr(requests, "get", fake_get)

    recs = mr.get_music_recommendation("joy", history=["joy", "happy"])
    assert all(r["name"].startswith("Joy") for r in recs)


# --- always returns something (never an empty list / surfaced error) -----
def test_empty_emotion_still_returns_fallback():
    assert len(mr.get_music_recommendation("")) > 0
    assert len(mr.get_music_recommendation("   ")) > 0


def test_token_failure_returns_curated_fallback(monkeypatch):
    def fail(*a, **k):
        raise requests.ConnectionError("no network")

    monkeypatch.setattr(requests, "post", fail)
    recs = mr.get_music_recommendation("joy")
    assert len(recs) > 0
    assert all(r["external_url"] for r in recs)


def test_spotify_search_failure_returns_curated_fallback(monkeypatch):
    monkeypatch.setattr(requests, "post", _token_response)

    def fail(*a, **k):
        raise requests.ConnectionError("boom")

    monkeypatch.setattr(requests, "get", fail)
    recs = mr.get_music_recommendation("joy")
    assert len(recs) > 0
