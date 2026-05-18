"""FastAPI application for the Moodify inference service.

The app is built by ``build_app()``, which takes the three loaded model
objects as arguments. Keeping construction separate from the Modal wiring
in modal_app.py makes the whole HTTP surface unit-testable without Modal,
torch, or the model weights (see modal_inference/tests/).

Each model object must expose:
  * ``loaded`` -> bool
  * ``predict(...)`` -> str (text) or an object with ``.emotion`` /
    ``.degraded`` (speech/facial).
"""

import logging
import os
import tempfile

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

import config
from auth import AuthError, authenticate
from recommendation.music_recommendation import get_music_recommendation
from schemas import (
    EmotionResponse,
    HealthResponse,
    MusicRecommendationRequest,
    TextEmotionRequest,
)

logger = logging.getLogger("moodify.inference.service")

# Max upload size accepted on the media endpoints (defence-in-depth).
MAX_UPLOAD_BYTES = 12 * 1024 * 1024


def build_app(text_model, speech_model, facial_model) -> FastAPI:
    """Construct the inference FastAPI app around three loaded models."""
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
        if not getattr(model, "loaded", False):
            raise HTTPException(status_code=503, detail=f"{name} model is unavailable")

    @web_app.get("/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        return HealthResponse(
            status="ok",
            models_loaded={
                "text": getattr(text_model, "loaded", False),
                "speech": getattr(speech_model, "loaded", False),
                "facial": getattr(facial_model, "loaded", False),
            },
        )

    @web_app.post("/text_emotion", response_model=EmotionResponse)
    def text_emotion(body: TextEmotionRequest, _ctx: dict = Depends(require_auth)):
        _require_loaded(text_model, "text")
        emotion = text_model.predict(body.text)
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
        data = file.file.read(MAX_UPLOAD_BYTES + 1)
        if len(data) > MAX_UPLOAD_BYTES:
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
    def speech_emotion(file: UploadFile = File(...), _ctx: dict = Depends(require_auth)):
        return _infer_from_upload(file, speech_model, "speech")

    @web_app.post("/facial_emotion", response_model=EmotionResponse)
    def facial_emotion(file: UploadFile = File(...), _ctx: dict = Depends(require_auth)):
        return _infer_from_upload(file, facial_model, "facial")

    return web_app
