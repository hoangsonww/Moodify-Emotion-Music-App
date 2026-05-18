"""Central configuration for the Moodify Modal inference service.

Values come from environment variables, which Modal injects from the
``moodify-secrets`` Secret at runtime. See ``.env.example`` for the full
list. Model weights live on a Modal Volume mounted at ``MODELS_DIR``.
"""

import os

# --- Modal resource names -------------------------------------------------
APP_NAME = "moodify-inference"
MODELS_VOLUME_NAME = "moodify-models"
SECRET_NAME = "moodify-secrets"

# --- Filesystem (inside the container) ------------------------------------
# The Modal Volume is mounted here; download_models.py populates it.
MODELS_DIR = "/models"
TEXT_EMOTION_DIR = os.path.join(MODELS_DIR, "text_emotion_model")
SPEECH_MODEL_PATH = os.path.join(MODELS_DIR, "speech_emotion_model", "trained_speech_emotion_model.pkl")
SPEECH_SCALER_PATH = os.path.join(MODELS_DIR, "speech_emotion_model", "scaler.pkl")
FACIAL_MODEL_PATH = os.path.join(MODELS_DIR, "facial_emotion_model", "trained_facial_emotion_model.pt")

# --- Inference settings ---------------------------------------------------
MAX_TEXT_LENGTH = 128
MFCC_COUNT = 40

# --- Secrets / runtime env (populated by the Modal Secret) ----------------
SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")

# Shared HS256 key: Django issues JWTs with it, Modal verifies with it.
JWT_SIGNING_KEY = os.getenv("JWT_SIGNING_KEY")
JWT_ALGORITHM = "HS256"

# Shared secret for trusted Django -> Modal proxy calls.
MODAL_SERVICE_TOKEN = os.getenv("MODAL_SERVICE_TOKEN")

# Comma-separated list of allowed browser origins for CORS.
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]

# --- Keep-warm / scaling tuning -------------------------------------------
# NOTE: Modal >= 0.64 uses `min_containers` / `scaledown_window`.
# Older SDKs: `keep_warm` / `container_idle_timeout`.
MIN_CONTAINERS = 1          # keep one container warm -> no cold starts
SCALEDOWN_WINDOW = 300      # seconds an idle container lingers
CONTAINER_CPU = 2.0
CONTAINER_MEMORY_MB = 4096


def require(name: str) -> str:
    """Return a required env var or raise a clear error if missing."""
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Required environment variable '{name}' is not set")
    return value
