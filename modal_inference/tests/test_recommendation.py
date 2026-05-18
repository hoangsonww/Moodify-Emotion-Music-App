"""Tests for the Spotify recommendation client (recommendation/)."""

import pytest
import requests

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


@pytest.fixture(autouse=True)
def _reset_token_cache(monkeypatch):
    """Reset the in-process Spotify token cache + provide credentials."""
    monkeypatch.setattr(mr, "_token_value", None, raising=False)
    monkeypatch.setattr(mr, "_token_expires_at", 0.0, raising=False)
    monkeypatch.setenv("SPOTIFY_CLIENT_ID", "id")
    monkeypatch.setenv("SPOTIFY_CLIENT_SECRET", "secret")


def test_emotion_keyword_map_covers_model_outputs():
    for emotion in ["sadness", "joy", "love", "anger", "fear", "neutral"]:
        assert emotion in mr.EMOTION_TO_KEYWORD


def test_access_token_is_cached(monkeypatch):
    calls = {"n": 0}

    def fake_post(*a, **k):
        calls["n"] += 1
        return _FakeResponse({"access_token": "tok", "expires_in": 3600})

    monkeypatch.setattr(requests, "post", fake_post)

    assert mr.get_spotify_access_token() == "tok"
    assert mr.get_spotify_access_token() == "tok"
    assert calls["n"] == 1  # second call served from cache


def test_get_music_recommendation_parses_tracks(monkeypatch):
    monkeypatch.setattr(
        requests, "post", lambda *a, **k: _FakeResponse({"access_token": "tok", "expires_in": 3600})
    )
    track = {
        "name": "Happy Song",
        "artists": [{"name": "Artist A"}, {"name": "Artist B"}],
        "preview_url": "https://preview",
        "external_urls": {"spotify": "https://track"},
        "album": {"images": [{"url": "https://image"}]},
    }
    monkeypatch.setattr(
        requests, "get", lambda *a, **k: _FakeResponse({"tracks": {"items": [track]}})
    )

    recs = mr.get_music_recommendation("joy")
    assert len(recs) == 1
    assert recs[0]["name"] == "Happy Song"
    assert recs[0]["artist"] == "Artist A, Artist B"
    assert recs[0]["external_url"] == "https://track"


def test_empty_emotion_returns_empty_list():
    assert mr.get_music_recommendation("") == []


def test_spotify_search_failure_returns_empty_list(monkeypatch):
    monkeypatch.setattr(
        requests, "post", lambda *a, **k: _FakeResponse({"access_token": "tok", "expires_in": 3600})
    )

    def fail(*a, **k):
        raise requests.ConnectionError("boom")

    monkeypatch.setattr(requests, "get", fail)
    assert mr.get_music_recommendation("joy") == []


def test_token_failure_returns_empty_list(monkeypatch):
    def fail(*a, **k):
        raise requests.ConnectionError("no network")

    monkeypatch.setattr(requests, "post", fail)
    assert mr.get_music_recommendation("joy") == []
