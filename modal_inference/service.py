"""FastAPI application for the Moodify inference service.

The app is built by ``build_app()``, which takes the three loaded model
objects as arguments. Keeping construction separate from the Modal wiring
in modal_app.py makes the whole HTTP surface unit-testable without Modal,
torch, or the model weights (see modal_inference/tests/).

Resilience: the emotion endpoints never fail because of a model. If a
model is unavailable or inference raises, the request still returns 200
with a neutral fallback emotion and ``degraded: true``; recommendations
are always non-empty (the Spotify client falls back to a curated set).
The only non-200 responses are 401 (authentication) and 422 (a malformed
request body) -- neither of which the apps trigger in normal use.

Each model object must expose:
  * ``loaded`` -> bool
  * ``predict(...)`` -> str (text) or an object with ``.emotion`` /
    ``.degraded`` (speech/facial).
"""

import hashlib
import logging
import os
import tempfile

from fastapi import Depends, FastAPI, File, Header, HTTPException, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware

import config
from auth import AuthError, authenticate
from cache import TTLCache
from inference import text_emotion as text_emotion_module
from rate_limit import SlidingWindowLimiter, caller_key
from recommendation import deezer as deezer_module
from recommendation.music_recommendation import get_music_recommendation
from schemas import (
    EmotionResponse,
    HealthResponse,
    MusicRecommendationRequest,
    TextEmotionRequest,
)

logger = logging.getLogger("moodify.inference.service")

# Per-media caches, keyed by sha256(upload bytes). Separate caches per
# modality so they don't collide on a coincidental hash match (sha256
# makes that astronomically unlikely, but separation is cheap and makes
# /health stats per-modality readable).
_speech_cache = TTLCache(
    max_size=config.CACHE_MEDIA_MAX,
    ttl_seconds=config.CACHE_MEDIA_TTL,
    name="speech_emotion",
)
_facial_cache = TTLCache(
    max_size=config.CACHE_MEDIA_MAX,
    ttl_seconds=config.CACHE_MEDIA_TTL,
    name="facial_emotion",
)


def get_media_caches() -> dict[str, TTLCache]:
    """Expose the media caches for /health observability and tests."""
    return {"speech_emotion": _speech_cache, "facial_emotion": _facial_cache}

# One limiter per service process. Created at import time so its counters
# accumulate across requests; tests can reset via ``reset_rate_limiter``.
_rate_limiter = SlidingWindowLimiter(
    limit=config.RATE_LIMIT_PER_USER,
    window=config.RATE_LIMIT_WINDOW,
)


def get_rate_limiter() -> SlidingWindowLimiter:
    """Expose the limiter so tests / /health can read its state."""
    return _rate_limiter


def reset_rate_limiter() -> None:
    """Drop all per-caller windows -- used by tests to isolate cases."""
    _rate_limiter.clear()
    _rate_limiter.reset_stats()

# Max upload size accepted on the media endpoints (defence-in-depth).
MAX_UPLOAD_BYTES = 12 * 1024 * 1024


def _detect(model, name, infer):
    """Run ``infer()`` -> (emotion, degraded), tolerating every failure.

    If the model is not loaded or inference raises, returns the neutral
    fallback emotion with degraded=True instead of propagating an error.
    """
    if not getattr(model, "loaded", False):
        logger.warning("%s model unavailable; using fallback emotion", name)
        return config.DEFAULT_EMOTION, True
    try:
        return infer()
    except Exception:  # noqa: BLE001
        logger.exception("%s inference failed; using fallback emotion", name)
        return config.DEFAULT_EMOTION, True


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

    def require_auth_and_quota(
        response: Response,
        authorization: str | None = Header(default=None),
    ) -> dict:
        """Auth + per-caller sliding-window rate limit.

        Service-token callers (Django -> Modal proxy) bypass the limit;
        they're already throttled per-user upstream by DRF, and double-
        limiting at the edge would punish well-behaved users for sharing
        the proxy. End-user JWTs are limited per ``sub`` claim, so a
        single account can't fan out across tabs to multiply its budget.

        On block we still set the standard ``X-RateLimit-*`` headers AND
        ``Retry-After`` so the front-end can back off intelligently
        instead of spinning -- this keeps the limit invisible during
        normal use while making misbehaviour obvious.
        """
        ctx = require_auth(authorization)
        if not config.RATE_LIMIT_ENABLED:
            return ctx
        key = caller_key(ctx)
        if key is None:
            # Service-token caller -- skip the limiter.
            return ctx
        decision = _rate_limiter.check(key)
        # Apply headers on every response so the client can see its
        # remaining budget on success too.
        for header_name, header_value in decision.as_headers().items():
            response.headers[header_name] = header_value
        if not decision.allowed:
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded -- slow down and retry shortly.",
                headers=decision.as_headers(),
            )
        return ctx

    @web_app.get("/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        return HealthResponse(
            status="ok",
            models_loaded={
                "text": getattr(text_model, "loaded", False),
                "speech": getattr(speech_model, "loaded", False),
                "facial": getattr(facial_model, "loaded", False),
            },
            caches={
                "text_emotion": text_emotion_module.get_cache().stats(),
                "deezer_search": deezer_module.get_cache().stats(),
                "speech_emotion": _speech_cache.stats(),
                "facial_emotion": _facial_cache.stats(),
            },
            rate_limit={
                "enabled": bool(config.RATE_LIMIT_ENABLED),
                **_rate_limiter.stats(),
            },
        )

    @web_app.post("/text_emotion", response_model=EmotionResponse)
    def text_emotion(body: TextEmotionRequest, _ctx: dict = Depends(require_auth_and_quota)):
        emotion, degraded = _detect(
            text_model, "text", lambda: (text_model.predict(body.text), False)
        )
        return EmotionResponse(
            emotion=emotion,
            recommendations=get_music_recommendation(emotion),
            degraded=degraded,
        )

    @web_app.post("/music_recommendation", response_model=EmotionResponse)
    def music_recommendation(
        body: MusicRecommendationRequest, _ctx: dict = Depends(require_auth_and_quota)
    ):
        return EmotionResponse(
            emotion=body.emotion,
            market=body.market,
            recommendations=get_music_recommendation(
                body.emotion, body.market, body.history
            ),
        )

    def _infer_from_upload(
        file: UploadFile, model, name: str, media_cache: TTLCache
    ) -> EmotionResponse:
        """Save an upload to a temp file and infer. Never raises: an empty,
        oversized or unreadable upload degrades to the fallback emotion.

        Identical uploads (same bytes) within the media-cache TTL skip
        the inference call entirely. Hashing the bytes costs ~10-15ms on
        a typical sub-MB upload, which is well below the actual model
        forward pass; the cache mostly defends against retry-storm
        pathologies (a stuck front-end resubmitting the same blob).
        Empty / oversized / degraded results are NOT cached so we never
        memoise a failure.
        """
        try:
            data = file.file.read(MAX_UPLOAD_BYTES + 1)
        except Exception:  # noqa: BLE001
            data = b""

        if not data or len(data) > MAX_UPLOAD_BYTES:
            logger.warning("%s upload unusable (empty/oversized); using fallback", name)
            emotion, degraded = config.DEFAULT_EMOTION, True
        else:
            content_key = hashlib.sha256(data).hexdigest()
            cached_label = media_cache.get(content_key)
            if cached_label is not None:
                emotion, degraded = cached_label, False
            else:
                suffix = os.path.splitext(file.filename or "")[1] or ".bin"
                tmp_path = None
                try:
                    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                        tmp.write(data)
                        tmp_path = tmp.name
                    emotion, degraded = _detect(
                        model,
                        name,
                        lambda: (lambda r: (r.emotion, r.degraded))(model.predict(tmp_path)),
                    )
                finally:
                    if tmp_path and os.path.exists(tmp_path):
                        os.unlink(tmp_path)
                # Only memoise successful, non-degraded inferences so a
                # transient failure (e.g. ffmpeg hiccup) doesn't get
                # locked in for the next 15 minutes.
                if not degraded:
                    media_cache.set(content_key, emotion)

        return EmotionResponse(
            emotion=emotion,
            recommendations=get_music_recommendation(emotion),
            degraded=degraded,
        )

    @web_app.post("/speech_emotion", response_model=EmotionResponse)
    def speech_emotion(file: UploadFile = File(...), _ctx: dict = Depends(require_auth_and_quota)):
        return _infer_from_upload(file, speech_model, "speech", _speech_cache)

    @web_app.post("/facial_emotion", response_model=EmotionResponse)
    def facial_emotion(file: UploadFile = File(...), _ctx: dict = Depends(require_auth_and_quota)):
        return _infer_from_upload(file, facial_model, "facial", _facial_cache)

    return web_app
