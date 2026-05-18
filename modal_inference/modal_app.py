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
    .pip_install("torch==2.2.2", index_url="https://download.pytorch.org/whl/cpu")
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
        "config", "auth", "schemas", "download_models", "inference", "recommendation"
    )
)

# --- Model weights volume -------------------------------------------------
models_volume = modal.Volume.from_name(config.MODELS_VOLUME_NAME, create_if_missing=True)

# Max upload size accepted on the media endpoints (defence-in-depth).
_MAX_UPLOAD_BYTES = 12 * 1024 * 1024


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
    # Keep one container warm so the hot path never pays a cold start.
    min_containers=config.MIN_CONTAINERS,
    scaledown_window=config.SCALEDOWN_WINDOW,
    # NVIDIA GPU flip (future): add `gpu="T4"` here and build from
    # requirements-gpu.txt -- see plan §7.
)
class InferenceService:
    """Loads all emotion models once per container; serves a FastAPI app."""

    @modal.enter()
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
        import os
        import tempfile

        from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
        from fastapi.middleware.cors import CORSMiddleware

        from auth import AuthError, authenticate
        from recommendation.music_recommendation import get_music_recommendation
        from schemas import (
            EmotionResponse,
            HealthResponse,
            MusicRecommendationRequest,
            TextEmotionRequest,
        )

        web_app = FastAPI(title="Moodify Inference", version="1.0.0")
        web_app.add_middleware(
            CORSMiddleware,
            allow_origins=config.ALLOWED_ORIGINS or ["*"],
            allow_methods=["POST", "GET", "OPTIONS"],
            allow_headers=["Authorization", "Content-Type"],
        )

        def require_auth(authorization: str | None = Header(default=None)) -> dict:
            """FastAPI dependency: accept an end-user JWT or the service token."""
            try:
                return authenticate(authorization)
            except AuthError as exc:
                raise HTTPException(status_code=401, detail=str(exc)) from exc

        def _require_loaded(model, name: str) -> None:
            if not model.loaded:
                raise HTTPException(status_code=503, detail=f"{name} model is unavailable")

        @web_app.get("/health", response_model=HealthResponse)
        def health() -> HealthResponse:
            return HealthResponse(
                status="ok",
                models_loaded={
                    "text": self.text_model.loaded,
                    "speech": self.speech_model.loaded,
                    "facial": self.facial_model.loaded,
                },
            )

        @web_app.post("/text_emotion", response_model=EmotionResponse)
        def text_emotion(body: TextEmotionRequest, _ctx: dict = Depends(require_auth)):
            _require_loaded(self.text_model, "text")
            emotion = self.text_model.predict(body.text)
            return EmotionResponse(
                emotion=emotion,
                recommendations=get_music_recommendation(emotion),
            )

        @web_app.post("/music_recommendation", response_model=EmotionResponse)
        def music_recommendation(
            body: MusicRecommendationRequest, _ctx: dict = Depends(require_auth)
        ):
            return EmotionResponse(
                emotion=body.emotion,
                market=body.market,
                recommendations=get_music_recommendation(body.emotion, body.market),
            )

        def _infer_from_upload(file: UploadFile, model, name: str) -> EmotionResponse:
            """Save an upload to a unique temp file, infer, always clean up."""
            _require_loaded(model, name)
            data = file.file.read(_MAX_UPLOAD_BYTES + 1)
            if len(data) > _MAX_UPLOAD_BYTES:
                raise HTTPException(status_code=413, detail="Uploaded file is too large")
            if not data:
                raise HTTPException(status_code=400, detail="Empty upload")

            suffix = os.path.splitext(file.filename or "")[1] or ".bin"
            tmp_path = None
            try:
                with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                    tmp.write(data)
                    tmp_path = tmp.name
                result = model.predict(tmp_path)
                return EmotionResponse(
                    emotion=result.emotion,
                    recommendations=get_music_recommendation(result.emotion),
                    degraded=result.degraded,
                )
            finally:
                if tmp_path and os.path.exists(tmp_path):
                    os.unlink(tmp_path)

        @web_app.post("/speech_emotion", response_model=EmotionResponse)
        def speech_emotion(
            file: UploadFile = File(...), _ctx: dict = Depends(require_auth)
        ):
            return _infer_from_upload(file, self.speech_model, "speech")

        @web_app.post("/facial_emotion", response_model=EmotionResponse)
        def facial_emotion(
            file: UploadFile = File(...), _ctx: dict = Depends(require_auth)
        ):
            return _infer_from_upload(file, self.facial_model, "facial")

        return web_app
