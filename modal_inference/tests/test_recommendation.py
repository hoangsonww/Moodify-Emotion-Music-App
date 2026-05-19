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


def _track(name, url="https://open.spotify.com/track/x"):
    return {
        "name": name,
        "type": "track",
        "artists": [{"name": "Some Artist"}],
        "preview_url": None,
        "external_urls": {"spotify": url},
        "album": {"images": [{"url": "https://img/cover.jpg"}]},
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


# --- failure handling -----------------------------------------------------
def test_empty_emotion_returns_empty_list():
    assert mr.get_music_recommendation("") == []
    assert mr.get_music_recommendation("   ") == []


def test_token_failure_returns_empty_list(monkeypatch):
    def fail(*a, **k):
        raise requests.ConnectionError("no network")

    monkeypatch.setattr(requests, "post", fail)
    assert mr.get_music_recommendation("joy") == []


def test_spotify_search_failure_returns_empty_list(monkeypatch):
    monkeypatch.setattr(requests, "post", _token_response)

    def fail(*a, **k):
        raise requests.ConnectionError("boom")

    monkeypatch.setattr(requests, "get", fail)
    assert mr.get_music_recommendation("joy") == []
