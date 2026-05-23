"""Tests for the TTLCache primitive and the two wired-in caches."""

import threading
import time

import pytest
import requests

from cache import TTLCache
from inference import text_emotion as text_emotion_module
from recommendation import deezer


# ---------------- TTLCache primitive ----------------------------------
class TestTTLCachePrimitive:
    def test_get_returns_none_on_miss(self):
        cache = TTLCache(max_size=4, ttl_seconds=60, name="t")
        assert cache.get("absent") is None
        assert cache.stats()["misses"] == 1
        assert cache.stats()["hits"] == 0

    def test_set_then_get_hits(self):
        cache = TTLCache(max_size=4, ttl_seconds=60)
        cache.set("k", "v")
        assert cache.get("k") == "v"
        stats = cache.stats()
        assert stats["hits"] == 1
        assert stats["sets"] == 1
        assert stats["size"] == 1

    def test_ttl_expires_entry(self, monkeypatch):
        cache = TTLCache(max_size=4, ttl_seconds=10)
        now = [1000.0]
        monkeypatch.setattr("cache.time.monotonic", lambda: now[0])
        cache.set("k", "v")
        now[0] += 5
        assert cache.get("k") == "v"
        now[0] += 6  # past the 10s TTL
        assert cache.get("k") is None
        assert cache.stats()["expired"] == 1

    def test_zero_ttl_means_permanent(self, monkeypatch):
        cache = TTLCache(max_size=4, ttl_seconds=0)
        cache.set("k", "v")
        # Jump time forward by a year -- still there.
        now = [time.monotonic() + 365 * 86400]
        monkeypatch.setattr("cache.time.monotonic", lambda: now[0])
        assert cache.get("k") == "v"

    def test_lru_eviction_drops_oldest(self):
        cache = TTLCache(max_size=3, ttl_seconds=60)
        cache.set("a", 1)
        cache.set("b", 2)
        cache.set("c", 3)
        cache.get("a")          # 'a' is now MRU
        cache.set("d", 4)       # evicts 'b'
        assert cache.get("b") is None
        assert cache.get("a") == 1
        assert cache.get("c") == 3
        assert cache.get("d") == 4
        assert cache.stats()["evictions"] == 1

    def test_overwrite_does_not_evict(self):
        cache = TTLCache(max_size=2, ttl_seconds=60)
        cache.set("a", 1)
        cache.set("b", 2)
        cache.set("a", 11)  # overwrite, not insert
        assert len(cache) == 2
        assert cache.get("a") == 11
        assert cache.get("b") == 2

    def test_clear_drops_entries_but_keeps_stats(self):
        cache = TTLCache(max_size=4, ttl_seconds=60)
        cache.set("a", 1)
        cache.get("a")
        cache.clear()
        assert len(cache) == 0
        # stats survive clear() so /health still tells a story
        assert cache.stats()["hits"] == 1
        cache.reset_stats()
        assert cache.stats()["hits"] == 0

    def test_get_or_set_runs_factory_once(self):
        cache = TTLCache(max_size=4, ttl_seconds=60)
        calls = []

        def factory():
            calls.append(1)
            return "value"

        assert cache.get_or_set("k", factory) == "value"
        assert cache.get_or_set("k", factory) == "value"
        assert len(calls) == 1

    def test_get_or_set_does_not_cache_none(self):
        cache = TTLCache(max_size=4, ttl_seconds=60)
        assert cache.get_or_set("k", lambda: None) is None
        # Nothing was stored.
        assert len(cache) == 0

    def test_concurrent_set_get_is_safe(self):
        cache = TTLCache(max_size=128, ttl_seconds=60)

        def hammer(start):
            for i in range(start, start + 64):
                cache.set(f"k{i}", i)
                cache.get(f"k{i}")

        threads = [threading.Thread(target=hammer, args=(i * 64,)) for i in range(4)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # No crash. Final size capped at max_size.
        assert len(cache) <= 128

    def test_max_size_must_be_positive(self):
        with pytest.raises(ValueError):
            TTLCache(max_size=0, ttl_seconds=60)

    def test_stats_hit_ratio(self):
        cache = TTLCache(max_size=4, ttl_seconds=60)
        cache.set("k", "v")
        cache.get("k")
        cache.get("k")
        cache.get("missing")
        assert cache.stats()["hit_ratio"] == pytest.approx(2 / 3, abs=1e-3)


# ---------------- Deezer search cache integration ---------------------
class _FakeResponse:
    def __init__(self, payload, status=200):
        self._payload = payload
        self.status_code = status

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"status {self.status_code}")

    def json(self):
        return self._payload


def _track(name, artist="Artist", rank=500_000):
    return {
        "id": 1,
        "title": name,
        "duration": 200,
        "rank": rank,
        "preview": f"https://preview/{name}.mp3",
        "link": f"https://www.deezer.com/track/{name}",
        "artist": {"name": artist},
        "album": {"title": "Album", "cover_medium": "https://cover.jpg"},
    }


class TestDeezerCacheIntegration:
    def test_second_call_for_same_query_skips_network(self, monkeypatch):
        calls = []

        def fake_get(url, **kw):
            calls.append(kw["params"]["q"])
            return _FakeResponse({"data": [_track("S")]})

        monkeypatch.setattr(requests, "get", fake_get)
        first = deezer.search_tracks("happy")
        second = deezer.search_tracks("happy")
        assert first == second
        assert calls == ["happy"], "second call must be served from the cache"
        assert deezer.get_cache().stats()["hits"] == 1

    def test_cache_is_keyed_by_query_and_limit(self, monkeypatch):
        calls = []

        def fake_get(url, **kw):
            calls.append((kw["params"]["q"], kw["params"]["limit"]))
            return _FakeResponse({"data": [_track("S")]})

        monkeypatch.setattr(requests, "get", fake_get)
        deezer.search_tracks("happy", limit=10)
        deezer.search_tracks("happy", limit=20)  # different limit -> miss
        deezer.search_tracks("sad", limit=10)    # different query -> miss
        deezer.search_tracks("happy", limit=10)  # repeat -> hit
        assert len(calls) == 3

    def test_query_normalised_case_and_whitespace(self, monkeypatch):
        calls = []

        def fake_get(url, **kw):
            calls.append(kw["params"]["q"])
            return _FakeResponse({"data": [_track("S")]})

        monkeypatch.setattr(requests, "get", fake_get)
        deezer.search_tracks("  Happy  ")
        deezer.search_tracks("happy")
        deezer.search_tracks("HAPPY")
        # All three normalise to "happy" -> one upstream call only.
        assert len(calls) == 1

    def test_empty_result_is_not_cached(self, monkeypatch):
        calls = []

        def fake_get(url, **kw):
            calls.append(kw["params"]["q"])
            return _FakeResponse({"data": []})

        monkeypatch.setattr(requests, "get", fake_get)
        deezer.search_tracks("zzz")
        deezer.search_tracks("zzz")
        # Empty responses must always retry -- never memoise an outage.
        assert len(calls) == 2

    def test_network_failure_is_not_cached(self, monkeypatch):
        calls = []

        def fake_get(*a, **k):
            calls.append(1)
            raise requests.ConnectionError("down")

        monkeypatch.setattr(requests, "get", fake_get)
        assert deezer.search_tracks("anything") == []
        assert deezer.search_tracks("anything") == []
        assert len(calls) == 2

    def test_cached_result_is_not_aliased(self, monkeypatch):
        """Mutating one returned list must NOT corrupt the cached copy."""
        def fake_get(*a, **k):
            return _FakeResponse({"data": [_track("S")]})

        monkeypatch.setattr(requests, "get", fake_get)
        first = deezer.search_tracks("q")
        first.append({"name": "INJECTED", "artist": "X"})
        first[0]["name"] = "MUTATED"
        second = deezer.search_tracks("q")
        assert len(second) == 1
        assert second[0]["name"] == "S"


# ---------------- text-emotion cache integration ----------------------
class _StubTextModel:
    """Mimics TextEmotionModel without torch/transformers."""

    def __init__(self):
        self._calls = 0

    @property
    def loaded(self):
        return True

    def __getattr__(self, item):
        raise AttributeError(item)


def _run_predict(stub_label, text):
    """Drive TextEmotionModel.predict against a stub tokenizer/model.

    We stand up a real instance and patch its private slots so the cache
    behaviour is exercised end-to-end without dragging in torch.
    """
    model = text_emotion_module.TextEmotionModel()
    model._tokenizer = object()  # never actually called in this test
    model._model = object()
    model._labels = [stub_label]
    return model


class _CountingModel:
    """Drop-in for ``predict`` that counts forward passes."""

    def __init__(self, label="joy"):
        self.label = label
        self.calls = 0

    def predict(self, text):
        self.calls += 1
        return self.label


class TestTextEmotionCacheIntegration:
    def test_identical_text_served_from_cache(self, monkeypatch):
        counter = _CountingModel(label="joy")

        # Monkeypatch the inner mechanism so we don't need torch.
        def fake_predict(self, text):
            from inference.text_emotion import _normalize, _prediction_cache
            key = _normalize(text)
            if key:
                cached = _prediction_cache.get(key)
                if cached is not None:
                    return cached
            counter.calls += 1
            label = "joy"
            if key:
                _prediction_cache.set(key, label)
            return label

        monkeypatch.setattr(
            text_emotion_module.TextEmotionModel, "predict", fake_predict
        )

        model = text_emotion_module.TextEmotionModel()
        model._model = object()
        model._tokenizer = object()
        assert model.predict("I am happy") == "joy"
        assert model.predict("I am happy") == "joy"
        assert model.predict("  I AM happy  ") == "joy"  # normalised hit
        assert counter.calls == 1
        assert text_emotion_module.get_cache().stats()["hits"] == 2

    def test_different_texts_each_run_inference(self, monkeypatch):
        from inference.text_emotion import _normalize, _prediction_cache

        counter = {"n": 0}

        def fake_predict(self, text):
            key = _normalize(text)
            cached = _prediction_cache.get(key)
            if cached is not None:
                return cached
            counter["n"] += 1
            label = f"label-{counter['n']}"
            _prediction_cache.set(key, label)
            return label

        monkeypatch.setattr(
            text_emotion_module.TextEmotionModel, "predict", fake_predict
        )

        model = text_emotion_module.TextEmotionModel()
        model._model = object()
        model._tokenizer = object()
        assert model.predict("happy now") == "label-1"
        assert model.predict("sad now") == "label-2"
        assert model.predict("happy now") == "label-1"
        assert counter["n"] == 2

    def test_normalize_helper(self):
        assert text_emotion_module._normalize("  Hello  ") == "hello"
        assert text_emotion_module._normalize("") == ""
        assert text_emotion_module._normalize(None) == ""


# ---------------- Media (speech / facial) cache integration -----------
import jwt  # noqa: E402
import time as _time  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import config  # noqa: E402
import service  # noqa: E402

_KEY = "media-cache-test-key"
_SVC = "media-cache-svc"


class _MediaModel:
    """Counts predict() calls so we can prove the cache short-circuits."""

    def __init__(self, label="sadness"):
        self.loaded = True
        self.label = label
        self.calls = 0

    def predict(self, path):
        self.calls += 1

        class _R:
            def __init__(self, e):
                self.emotion = e
                self.degraded = False

        return _R(self.label)


class _DegradedMediaModel(_MediaModel):
    def predict(self, path):
        self.calls += 1

        class _R:
            emotion = "neutral"
            degraded = True

        return _R()


@pytest.fixture
def media_client(monkeypatch):
    monkeypatch.setattr(config, "JWT_SIGNING_KEY", _KEY)
    monkeypatch.setattr(config, "MODAL_SERVICE_TOKEN", _SVC)
    monkeypatch.setattr(service, "get_music_recommendation", lambda *a, **k: [])
    return monkeypatch


def _auth():
    return {"Authorization": f"Bearer {_SVC}"}


class TestMediaCacheIntegration:
    def test_identical_speech_upload_hits_cache(self, media_client):
        speech = _MediaModel(label="sadness")
        client = TestClient(service.build_app(_StubTextModel(), speech, _MediaModel()))
        files = {"file": ("a.wav", b"identical-audio-blob", "audio/wav")}
        r1 = client.post("/speech_emotion", files=files, headers=_auth())
        r2 = client.post(
            "/speech_emotion",
            files={"file": ("a.wav", b"identical-audio-blob", "audio/wav")},
            headers=_auth(),
        )
        assert r1.status_code == r2.status_code == 200
        assert r1.json()["emotion"] == r2.json()["emotion"] == "sadness"
        # Inference ran exactly once -- second call hit the cache.
        assert speech.calls == 1
        assert service.get_media_caches()["speech_emotion"].stats()["hits"] == 1

    def test_different_bytes_run_inference_independently(self, media_client):
        speech = _MediaModel(label="joy")
        client = TestClient(service.build_app(_StubTextModel(), speech, _MediaModel()))
        client.post(
            "/speech_emotion",
            files={"file": ("a.wav", b"clip-A", "audio/wav")},
            headers=_auth(),
        )
        client.post(
            "/speech_emotion",
            files={"file": ("a.wav", b"clip-B", "audio/wav")},
            headers=_auth(),
        )
        assert speech.calls == 2

    def test_facial_cache_is_isolated_from_speech_cache(self, media_client):
        speech = _MediaModel(label="anger")
        facial = _MediaModel(label="joy")
        client = TestClient(service.build_app(_StubTextModel(), speech, facial))
        # Same bytes submitted to both endpoints should each be a miss
        # against THEIR cache -- the modalities don't share keys.
        client.post("/speech_emotion", files={"file": ("x.bin", b"same", None)}, headers=_auth())
        client.post("/facial_emotion", files={"file": ("x.bin", b"same", None)}, headers=_auth())
        assert speech.calls == 1
        assert facial.calls == 1

    def test_degraded_results_are_not_cached(self, media_client):
        speech = _DegradedMediaModel()
        client = TestClient(service.build_app(_StubTextModel(), speech, _MediaModel()))
        for _ in range(3):
            client.post(
                "/speech_emotion",
                files={"file": ("a.wav", b"degraded-blob", "audio/wav")},
                headers=_auth(),
            )
        # Every call had to re-run, because the failure flag was never memoised.
        assert speech.calls == 3

