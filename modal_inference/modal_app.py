"""Moodify ML inference service -- Modal deployment.

This service replaces in-process Django inference and the legacy Flask app
(ai_ml/src/api/emotion_api.py). All three emotion models are loaded ONCE
per container via @modal.enter() and reused across requests.

Commands
--------
Populate model weights (run once, and on model updates):
    modal run modal_app.py::download_models
Serve locally for development:
    modal serve modal_app.py
Deploy to production:
    modal deploy modal_app.py

Run these from inside the modal_inference/ directory.

NOTE: this is scaffolding. The inference model classes and the Spotify
recommendation function still raise NotImplementedError -- see
docs/PRODUCTION_REFACTOR_PLAN.md §10 (Phase 1). The structure, Modal wiring,
auth, CORS and routing below are intended to be the final shape.
"""

import modal

import config

app = modal.App(config.APP_NAME)

# --- Container image ------------------------------------------------------
# CPU-only PyTorch wheels are installed from the dedicated index to keep the
# image small. The NVIDIA GPU variant (requirements-gpu.txt + gpu=... on the
# @app.cls below) is documented in docs/PRODUCTION_REFACTOR_PLAN.md §7.
inference_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "libsndfile1")
    .pip_install(
        "torch==2.2.2",
        "torchvision==0.17.2",
        "torchaudio==2.2.2",
        index_url="https://download.pytorch.org/whl/cpu",
    )
    .pip_install_from_requirements("requirements.txt")
    .add_local_python_source(
        "config",
        "auth",
        "schemas",
        "download_models",
        "inference",
        "recommendation",
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
    """Populate the Modal Volume with model weights, then commit it."""
    from download_models import fetch_all

    fetch_all(config.MODELS_DIR)
    models_volume.commit()
    print(f"Model weights committed to volume '{config.MODELS_VOLUME_NAME}'.")


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
    """Loads all three emotion models once per container; serves FastAPI."""

    @modal.enter()
    def load_models(self) -> None:
        """Runs once on container start -- fixes per-request model loading."""
        from inference.facial_emotion import FacialEmotionModel
        from inference.speech_emotion import SpeechEmotionModel
        from inference.text_emotion import TextEmotionModel

        self.text_model = TextEmotionModel()
        self.speech_model = SpeechEmotionModel()
        self.facial_model = FacialEmotionModel()

        # TODO(impl): uncomment once the inference modules are completed.
        # self.text_model.load()
        # self.speech_model.load()
        # self.facial_model.load()

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

        def _infer_from_upload(file: UploadFile, model) -> EmotionResponse:
            """Save an upload to a unique temp file, infer, always clean up."""
            suffix = os.path.splitext(file.filename or "")[1] or ".bin"
            tmp_path = None
            try:
                with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                    tmp.write(file.file.read())
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
            return _infer_from_upload(file, self.speech_model)

        @web_app.post("/facial_emotion", response_model=EmotionResponse)
        def facial_emotion(
            file: UploadFile = File(...), _ctx: dict = Depends(require_auth)
        ):
            return _infer_from_upload(file, self.facial_model)

        return web_app
