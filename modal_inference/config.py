"""Central configuration for the Moodify Modal inference service.

Values come from environment variables, which Modal injects from the
``moodify-secrets`` Secret at runtime. See ``.env.example`` for the full
list.

Model assets:
  * Text emotion (BERT) -- large ``model.safetensors`` lives on the Modal
    Volume mounted at ``MODELS_DIR``; the small tokenizer/config files are
    bundled in the image under ``ASSETS_DIR`` and copied into the Volume by
    download_models.py.
  * Speech emotion -- the small pickled model + scaler are bundled in the
    image under ``ASSETS_DIR`` (no Volume needed).
  * Facial emotion -- uses the ``fer`` library's bundled pretrained model;
    no custom weight file is required.
"""

import os

# --- Modal resource names -------------------------------------------------
APP_NAME = "moodify-inference"
MODELS_VOLUME_NAME = "moodify-models"
SECRET_NAME = "moodify-secrets"

# --- Filesystem (inside the container) ------------------------------------
# Bundled in the image (see modal_app.py add_local_dir).
ASSETS_DIR = "/assets"
SPEECH_MODEL_PATH = os.path.join(ASSETS_DIR, "speech_emotion_model", "trained_speech_emotion_model.pkl")
SPEECH_SCALER_PATH = os.path.join(ASSETS_DIR, "speech_emotion_model", "scaler.pkl")
TEXT_ASSETS_DIR = os.path.join(ASSETS_DIR, "text_emotion_model")

# Modal Volume mount -- holds the assembled text emotion model directory.
MODELS_DIR = "/models"
TEXT_EMOTION_DIR = os.path.join(MODELS_DIR, "text_emotion_model")

# --- Inference settings ---------------------------------------------------
MAX_TEXT_LENGTH = 128
MFCC_COUNT = 40

# The fine-tuned BERT classifier was trained on the dair-ai/emotion dataset
# with the "surprise" class (label 5) filtered out -- see
# ai_ml/src/models/train_text_emotion.py. The saved config.json only carries
# generic LABEL_n names, so this canonical ordering is authoritative.
TEXT_EMOTION_LABELS = ["sadness", "joy", "love", "anger", "fear"]

# Neutral default returned (with degraded=True) when a model fails, instead
# of the legacy behaviour of silently picking a random emotion.
DEFAULT_EMOTION = "neutral"

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
CONTAINER_MEMORY_MB = 8192  # headroom for PyTorch + TensorFlow (FER) together


def require(name: str) -> str:
    """Return a required env var or raise a clear error if missing."""
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Required environment variable '{name}' is not set")
    return value
