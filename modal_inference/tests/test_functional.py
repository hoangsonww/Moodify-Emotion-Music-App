"""Real end-to-end functional tests for the Modal inference service.

Unlike test_service.py (which uses fake models), these load the ACTUAL
emotion models and run real inference through the FastAPI app:

  * speech  -> the pickled SVC + scaler from assets/, real librosa MFCCs
  * facial  -> the real FER detector (TensorFlow + facenet-pytorch MTCNN)
  * text    -> a real BertForSequenceClassification built from the bundled
               config (random weights -- this exercises the real
               tokenize -> forward -> argmax -> label code path; the
               trained weights only affect prediction quality)

They need the full ML stack (torch, transformers, librosa, scikit-learn,
fer, tensorflow) and are skipped when it is absent, so the lightweight CI
suite is unaffected. Run locally after `pip install -r requirements.txt`:

    pytest tests/test_functional.py -v
"""

import importlib.util
import io
import os
import shutil
import tempfile
import time

import pytest

os.environ.setdefault("TF_USE_LEGACY_KERAS", "1")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")

import config  # noqa: E402  (light: stdlib only)

_REQUIRED = ["torch", "transformers", "librosa", "sklearn", "numpy", "soundfile", "cv2", "fer"]
_MISSING = [m for m in _REQUIRED if importlib.util.find_spec(m) is None]
pytestmark = pytest.mark.skipif(
    bool(_MISSING), reason=f"full ML stack not installed: missing {_MISSING}"
)

_SIGNING_KEY = "functional-test-signing-key"
_SERVICE_TOKEN = "functional-service-token"
_HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # modal_inference/


@pytest.fixture(scope="module")
def models():
    """Load all three real models once for the module (slow)."""
    # Speech: point at the real pickled artifacts bundled in the repo.
    config.SPEECH_MODEL_PATH = os.path.join(
        _HERE, "assets/speech_emotion_model/trained_speech_emotion_model.pkl"
    )
    config.SPEECH_SCALER_PATH = os.path.join(_HERE, "assets/speech_emotion_model/scaler.pkl")

    # Text: assemble a real model dir from the bundled tokenizer/config plus
    # a config-initialised BertForSequenceClassification.
    from transformers import AutoConfig, AutoModelForSequenceClassification

    tmp = tempfile.mkdtemp()
    text_dir = os.path.join(tmp, "text_emotion_model")
    os.makedirs(text_dir)
    asset_src = os.path.join(_HERE, "assets/text_emotion_model")
    for name in os.listdir(asset_src):
        shutil.copy2(os.path.join(asset_src, name), text_dir)
    AutoModelForSequenceClassification.from_config(
        AutoConfig.from_pretrained(asset_src)
    ).save_pretrained(text_dir)
    config.TEXT_EMOTION_DIR = text_dir

    from inference.facial_emotion import FacialEmotionModel
    from inference.speech_emotion import SpeechEmotionModel
    from inference.text_emotion import TextEmotionModel

    text, speech, facial = TextEmotionModel(), SpeechEmotionModel(), FacialEmotionModel()
    text.load()
    speech.load()
    facial.load()
    yield text, speech, facial
    shutil.rmtree(tmp, ignore_errors=True)


@pytest.fixture
def client(models, monkeypatch):
    """A TestClient over the real FastAPI app, with Spotify stubbed out."""
    from fastapi.testclient import TestClient

    import service

    monkeypatch.setattr(config, "MODAL_SERVICE_TOKEN", _SERVICE_TOKEN)
    monkeypatch.setattr(config, "JWT_SIGNING_KEY", _SIGNING_KEY)
    monkeypatch.setattr(
        service,
        "get_music_recommendation",
        lambda *a, **k: [{"name": "Track", "artist": "Artist", "external_url": "https://x"}],
    )
    return TestClient(service.build_app(*models))


def _user_auth():
    import jwt

    token = jwt.encode(
        {"sub": "u1", "username": "alice", "type": "access", "exp": int(time.time()) + 300},
        _SIGNING_KEY,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


def _wav_bytes(seconds=1, sr=22050):
    import numpy as np
    import soundfile as sf

    t = np.arange(int(sr * seconds)) / sr
    tone = (0.3 * np.sin(2 * np.pi * 220 * t) + 0.03 * np.random.randn(len(t))).astype("float32")
    buf = io.BytesIO()
    sf.write(buf, tone, sr, format="WAV")
    return buf.getvalue()


def _jpeg_bytes():
    import cv2
    import numpy as np

    img = (np.random.rand(220, 220, 3) * 255).astype("uint8")
    return cv2.imencode(".jpg", img)[1].tobytes()


# --- Health ---------------------------------------------------------------
def test_health_reports_all_models_loaded(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["models_loaded"] == {"text": True, "speech": True, "facial": True}


# --- Text emotion (real BERT forward pass) --------------------------------
def test_text_emotion_real_inference(client):
    resp = client.post("/text_emotion", json={"text": "I feel wonderful today"}, headers=_user_auth())
    assert resp.status_code == 200
    body = resp.json()
    assert body["emotion"] in config.TEXT_EMOTION_LABELS
    assert isinstance(body["recommendations"], list)


def test_text_emotion_validates_input(client):
    assert client.post("/text_emotion", json={"text": ""}, headers=_user_auth()).status_code == 422


# --- Speech emotion (real librosa + SVC) ----------------------------------
def test_speech_emotion_real_inference(client):
    resp = client.post(
        "/speech_emotion",
        files={"file": ("clip.wav", _wav_bytes(), "audio/wav")},
        headers=_user_auth(),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body["emotion"], str) and body["emotion"]


def test_speech_emotion_empty_upload_degrades_gracefully(client):
    # An unusable upload never errors -- it returns a degraded result.
    resp = client.post(
        "/speech_emotion", files={"file": ("clip.wav", b"", "audio/wav")}, headers=_user_auth()
    )
    assert resp.status_code == 200
    assert resp.json()["degraded"] is True


# --- Facial emotion (real FER detector) -----------------------------------
def test_facial_emotion_real_inference(client):
    resp = client.post(
        "/facial_emotion",
        files={"file": ("face.jpg", _jpeg_bytes(), "image/jpeg")},
        headers=_user_auth(),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body["emotion"], str) and body["emotion"]
    # A noise image has no detectable face -> graceful degraded result.
    assert body["degraded"] is True


# --- Music recommendation -------------------------------------------------
def test_music_recommendation(client):
    resp = client.post("/music_recommendation", json={"emotion": "joy"}, headers=_user_auth())
    assert resp.status_code == 200
    assert resp.json()["emotion"] == "joy"


# --- Auth -----------------------------------------------------------------
def test_endpoints_require_auth(client):
    assert client.post("/text_emotion", json={"text": "hi"}).status_code == 401


def test_invalid_token_rejected(client):
    resp = client.post(
        "/text_emotion", json={"text": "hi"}, headers={"Authorization": "Bearer not-a-jwt"}
    )
    assert resp.status_code == 401


def test_service_token_accepted(client):
    resp = client.post(
        "/text_emotion",
        json={"text": "hi"},
        headers={"Authorization": f"Bearer {_SERVICE_TOKEN}"},
    )
    assert resp.status_code == 200
