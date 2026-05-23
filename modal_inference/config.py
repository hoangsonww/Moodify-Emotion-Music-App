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
# Music recommendations now come from Deezer's keyless public API; no
# Spotify (or any other) credential is required for the recommender.

# Hugging Face repo holding the fine-tuned text-emotion model (config +
# tokenizer + model.safetensors). HF_TOKEN is only needed for a private repo.
HF_TEXT_MODEL_REPO = os.getenv("HF_TEXT_MODEL_REPO", "")
HF_TOKEN = os.getenv("HF_TOKEN")

# Shared HS256 key: Django issues JWTs with it, Modal verifies with it.
JWT_SIGNING_KEY = os.getenv("JWT_SIGNING_KEY")
JWT_ALGORITHM = "HS256"

# Shared secret for trusted Django -> Modal proxy calls.
MODAL_SERVICE_TOKEN = os.getenv("MODAL_SERVICE_TOKEN")

# Comma-separated list of allowed browser origins for CORS.
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]

# --- Caching ---------------------------------------------------------------
# Two caches sit in front of the costly bits of the request path:
#   * Deezer track search -- mood-keyword queries are highly repeated and
#     the upstream result is stable within an hour; collapsing repeats
#     saves a network round trip AND a Deezer hit.
#   * Text emotion -- the BERT classifier is deterministic on the
#     lowercased input (bert-base-uncased), so identical text returns the
#     identical label; we can serve repeats from RAM with zero accuracy
#     cost.
# Caches are LRU-bounded and per-entry TTL'd; they live in the container
# process, so each Modal replica has its own. That's fine: the win is
# saving repeated work inside a single user's session.
CACHE_DEEZER_TTL = float(os.getenv("CACHE_DEEZER_TTL", "3600"))      # 1 h
CACHE_DEEZER_MAX = int(os.getenv("CACHE_DEEZER_MAX", "256"))
CACHE_TEXT_TTL = float(os.getenv("CACHE_TEXT_TTL", "86400"))         # 24 h
CACHE_TEXT_MAX = int(os.getenv("CACHE_TEXT_MAX", "2048"))
# Speech / facial uploads -- keyed by a content hash (sha256 of the
# bytes). Repeat-hit rate is dominated by retry storms (seconds), demo
# sessions (minutes-hours) and same-user re-uploads inside a working
# session. The cache stores ONLY the predicted label (~120 B per entry),
# never the bytes, so privacy and RAM cost are both negligible at any
# TTL. Two hard invalidations sit upstream of the TTL anyway:
#   * Modal SCALEDOWN_WINDOW (5 min idle) -> container dies -> empty cache.
#   * `modal deploy` -> new container revision -> empty cache.
# So the TTL only really bounds staleness during a *sustained* session,
# which means a longer TTL is strictly better -- more hits captured, no
# downside. 6 h comfortably covers a workday of repeated demo uploads.
CACHE_MEDIA_TTL = float(os.getenv("CACHE_MEDIA_TTL", "21600"))       # 6 h
CACHE_MEDIA_MAX = int(os.getenv("CACHE_MEDIA_MAX", "256"))

# --- Rate limiting ---------------------------------------------------------
# Per-caller sliding-window throttle on the inference endpoints. Two
# tiers because the modalities have very different compute costs:
#
#   * "general"  -- /text_emotion + /music_recommendation: cheap
#                   (~50-100 ms each). 60 req/60s per user is plenty.
#   * "media"    -- /speech_emotion + /facial_emotion: 5-10x more
#                   expensive per call. Tighter ceiling so a stuck
#                   front-end can't fan compute cost out to infinity.
#
# Sized so a real user (one tap = one request) NEVER hits either limit
# during normal use, but a stuck loop or script trips within seconds.
# Service-token (Django -> Modal) calls bypass this layer: Django
# already throttles them per-user upstream via DRF.
#
# NOTE: limits are per-container (in-memory). When Modal scales out to
# N containers, the effective ceiling is N * limit per user during a
# burst -- see rate_limit.py for the trade-off discussion.
RATE_LIMIT_ENABLED = os.getenv("RATE_LIMIT_ENABLED", "1").lower() not in ("0", "false", "no")
# Defaults are *UX-balanced*: a real user (including a demo session
# fanning the app out across all three modalities) cannot trip them.
# The actual cost ceiling lives one layer down at MAX_CONTAINERS, so
# loosening the per-user limit doesn't widen the bill -- it only
# changes WHICH callers get a 429 first when the service is saturated.
#
#   * 45 general req/min ~= 1 call every 1.3 s sustained. A demo
#     toggling moods rapidly hits maybe 20-30/min. Headroom: ~50%.
#   * 15 media  req/min  = 1 upload every 4 s sustained. Recording +
#     sending an emotion clip realistically takes 5-15 s in the UI,
#     so a power-user demo hits maybe 4-6/min. Headroom: ~3x.
#
# Anything that *does* trip these limits (retry loop, scripted abuse,
# crawler) is by definition not a UX path.
RATE_LIMIT_PER_USER = int(os.getenv("RATE_LIMIT_PER_USER", "45"))
RATE_LIMIT_MEDIA_PER_USER = int(os.getenv("RATE_LIMIT_MEDIA_PER_USER", "15"))
RATE_LIMIT_WINDOW = float(os.getenv("RATE_LIMIT_WINDOW", "60"))

# --- Scaling / cost tuning ------------------------------------------------
# Scale to zero: no container runs (and nothing is billed) while the
# service is idle. You only pay for actual request-handling time plus the
# short scaledown tail -- which keeps Modal usage well inside its free
# monthly compute credit. Cold starts are kept fast by memory snapshotting
# (enable_memory_snapshot in modal_app.py).
# NOTE: Modal >= 0.64 uses `min_containers` / `scaledown_window` /
# `max_containers`.
MIN_CONTAINERS = 0          # 0 = scale to zero when idle (cheapest)
SCALEDOWN_WINDOW = 300      # keep a container warm 5 min after the last request
CONTAINER_CPU = 1.0         # ample for these small models
# All three models load in ~1.3 GB (measured); 4 GB leaves headroom for
# concurrent requests and the memory snapshot.
CONTAINER_MEMORY_MB = 4096
# Hard ceiling on parallel containers -- the LAST line of cost defence
# below the per-user rate limit and the cache layer. With 1 vCPU + 4 GB
# at Modal's CPU pricing, 5 fully-saturated containers cost roughly
# $0.03/min ($45/day worst case), and the per-user 30/min limit means a
# realistic concurrent user count of 5 * 30 = 150 saturating users
# before any of them get a 429 -- well above this app's traffic shape.
# Bump this only if you see the upper bound hit in /health logs and you
# actually have the users to justify the extra spend.
MAX_CONTAINERS = int(os.getenv("MAX_CONTAINERS", "5"))


def require(name: str) -> str:
    """Return a required env var or raise a clear error if missing."""
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Required environment variable '{name}' is not set")
    return value
