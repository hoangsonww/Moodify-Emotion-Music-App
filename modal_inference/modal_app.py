"""Moodify ML inference service -- Modal deployment.

This service replaces in-process Django inference and the legacy Flask app
(ai_ml/src/api/emotion_api.py). All emotion models are loaded ONCE per
container via @modal.enter() and reused across requests.

Commands (run from inside the modal_inference/ directory)
---------------------------------------------------------
Populate the text-model weights on the Volume (run once / on updates):
    modal run modal_app.py::download_models
Serve locally for development:
    modal serve modal_app.py
Deploy to production:
    modal deploy modal_app.py

After deploy, set MODAL_INFERENCE_URL in the Django/Vercel environment to
the printed service URL.

The inference modules, recommendation client, auth, CORS and routing are
fully implemented. The only environment-dependent step is running
``download_models`` once so the BERT weights are on the Volume.
"""

import logging

import modal

import config

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("moodify.inference")

app = modal.App(config.APP_NAME)

# --- Container image ------------------------------------------------------
# CPU-only PyTorch wheels keep the image small. The NVIDIA GPU variant
# (requirements-gpu.txt + gpu=... on the @app.cls) is documented in
# docs/PRODUCTION_REFACTOR_PLAN.md §7.
inference_image = (
    modal.Image.debian_slim(python_version="3.11")
    # ffmpeg/libsndfile -> audio decoding; libgl/libglib -> OpenCV (FER).
    .apt_install("ffmpeg", "libsndfile1", "libgl1", "libglib2.0-0")
    # torchvision is required by facenet-pytorch (FER's face detector).
    .pip_install(
        "torch==2.2.2",
        "torchvision==0.17.2",
        index_url="https://download.pytorch.org/whl/cpu",
    )
    .pip_install_from_requirements("requirements.txt")
    # FER runs on TensorFlow; force the legacy-Keras path so its bundled
    # .h5 model loads under TF 2.17. Quiet the TF/transformers logs.
    .env(
        {
            "TF_USE_LEGACY_KERAS": "1",
            "TF_CPP_MIN_LOG_LEVEL": "3",
            "HF_HUB_OFFLINE": "1",
            "TRANSFORMERS_OFFLINE": "1",
        }
    )
    # Bundled small model assets (tokenizer/config + speech pickles).
    .add_local_dir("assets", "/assets")
    # Local Python source so the container can import our packages.
    .add_local_python_source(
        "config", "auth", "schemas", "service", "download_models", "inference", "recommendation"
    )
)

# --- Model weights volume -------------------------------------------------
models_volume = modal.Volume.from_name(config.MODELS_VOLUME_NAME, create_if_missing=True)


@app.function(
    image=inference_image,
    volumes={config.MODELS_DIR: models_volume},
    timeout=1800,
)
def download_models() -> None:
    """Populate the Modal Volume with the text-model weights, then commit."""
    from download_models import fetch_all

    fetch_all(config.MODELS_DIR)
    models_volume.commit()
    logger.info("Model weights committed to volume '%s'.", config.MODELS_VOLUME_NAME)


@app.cls(
    image=inference_image,
    volumes={config.MODELS_DIR: models_volume},
    secrets=[modal.Secret.from_name(config.SECRET_NAME)],
    cpu=config.CONTAINER_CPU,
    memory=config.CONTAINER_MEMORY_MB,
    # Scale to zero when idle (no idle billing); a request spins a container
    # up. scaledown_window keeps it warm briefly so bursts reuse it.
    min_containers=config.MIN_CONTAINERS,
    scaledown_window=config.SCALEDOWN_WINDOW,
    # Snapshot the container after the models are loaded, so a cold start
    # restores in seconds instead of re-importing torch/TF and re-loading
    # every model. This is what keeps "scale to zero" fast enough for good
    # UX. If cold starts ever misbehave, remove this line and `snap=True`
    # below -- the service still works, just with slower cold starts.
    enable_memory_snapshot=True,
    # NVIDIA GPU flip (future): add `gpu="T4"` here and build from
    # requirements-gpu.txt -- see plan §7.
)
class InferenceService:
    """Loads all emotion models once per container; serves a FastAPI app."""

    @modal.enter(snap=True)
    def load_models(self) -> None:
        """Runs once on container start -- fixes per-request model loading.

        Each model is loaded independently: a single model failing to load
        must not take down the whole service -- its endpoint will report
        503 while the others keep serving.
        """
        from inference.facial_emotion import FacialEmotionModel
        from inference.speech_emotion import SpeechEmotionModel
        from inference.text_emotion import TextEmotionModel

        self.text_model = TextEmotionModel()
        self.speech_model = SpeechEmotionModel()
        self.facial_model = FacialEmotionModel()

        for name, model in (
            ("text", self.text_model),
            ("speech", self.speech_model),
            ("facial", self.facial_model),
        ):
            try:
                model.load()
                logger.info("Loaded %s emotion model", name)
            except Exception:  # noqa: BLE001
                logger.exception("Failed to load %s emotion model", name)

    @modal.asgi_app()
    def web(self):
        """Build and return the FastAPI app served by this container."""
        from service import build_app

        return build_app(self.text_model, self.speech_model, self.facial_model)
