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
import time

from fastapi import (
    Depends,
    FastAPI,
    File,
    Header,
    HTTPException,
    Request,
    Response,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware

import config
from auth import AuthError, authenticate, authenticate_service_only
from cache import TTLCache
from inference import text_emotion as text_emotion_module
import metrics as metrics_module
import metrics_store
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

# Two limiters per service process. The "general" one covers cheap JSON
# endpoints (text + recs); the "media" one covers expensive uploads
# (speech + facial). Splitting lets us protect compute budget where it
# actually matters without making the general limit absurdly tight for
# normal UX. Each user has separate budgets in each tier so heavy
# uploaders don't lock themselves out of text inference.
_rate_limiter = SlidingWindowLimiter(
    limit=config.RATE_LIMIT_PER_USER,
    window=config.RATE_LIMIT_WINDOW,
)
_media_rate_limiter = SlidingWindowLimiter(
    limit=config.RATE_LIMIT_MEDIA_PER_USER,
    window=config.RATE_LIMIT_WINDOW,
)


def get_rate_limiter() -> SlidingWindowLimiter:
    """Expose the general limiter so tests / /health can read its state."""
    return _rate_limiter


def get_media_rate_limiter() -> SlidingWindowLimiter:
    """Expose the media limiter so tests / /health can read its state."""
    return _media_rate_limiter


def reset_rate_limiter() -> None:
    """Drop all per-caller windows AND restore configured limits.

    Used by the test fixture in conftest.py so a test that mutates a
    limit doesn't leak that state into the next case.
    """
    for rl, limit in (
        (_rate_limiter, config.RATE_LIMIT_PER_USER),
        (_media_rate_limiter, config.RATE_LIMIT_MEDIA_PER_USER),
    ):
        rl.clear()
        rl.reset_stats()
        # Tests reach into ``_limit`` directly; reset it to the env default.
        rl._limit = int(limit)  # noqa: SLF001 -- intentional reset hook

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


def _normalise_endpoint(request) -> str:
    """Collapse high-cardinality path params to the route template.

    A naked ``request.url.path`` would have one bucket per user_id /
    track_id, exploding the metrics cardinality. FastAPI exposes the
    matched route in ``request.scope["route"]`` -- using its path
    template (``/users/{user_id}/profile/``) collapses every variant
    to a single key. Falls back to the raw path if no route matched
    (404 / OPTIONS preflight / etc).
    """
    route = request.scope.get("route") if hasattr(request, "scope") else None
    template = getattr(route, "path", None) if route else None
    return template or request.url.path or "/"


def build_app(text_model, speech_model, facial_model) -> FastAPI:
    """Construct the inference FastAPI app around three loaded models."""
    web_app = FastAPI(title="Moodify Inference", version="1.0.0")

    # --- Metrics middleware ------------------------------------------------
    # Times every request, records to the in-process recorder AND
    # persists one event row to Mongo. Wrapped so a metrics failure
    # CANNOT break the underlying request -- both the record and the
    # store call are already individually defensive.
    @web_app.middleware("http")
    async def _metrics_middleware(request, call_next):
        # /metrics, /docs, /redoc, /openapi.json, / -- skip to keep the
        # store cheap and avoid the obvious recursive case.
        path = request.url.path or "/"
        # /health is a liveness probe -- uptime monitors hit it every
        # 10-60 s. Persisting every probe would drown the time-series
        # in noise without adding signal. Same for the docs URLs.
        skip = path in (
            "/",
            "/health",
            "/metrics",
            "/docs",
            "/redoc",
            "/openapi.json",
            "/robots.txt",
            "/favicon.ico",
        )
        start = time.perf_counter()
        status_code = 500
        # The ``X-Moodify-Degraded`` header is set by inference handlers
        # on the model-fallback path; the middleware reads it AFTER the
        # response object is built but BEFORE it's sent, which is the
        # only safe place (response.body is a one-shot stream).
        degraded = False
        try:
            response = await call_next(request)
            status_code = int(getattr(response, "status_code", 500))
            try:
                degraded = response.headers.get("x-moodify-degraded") == "1"
            except Exception:  # noqa: BLE001
                pass
            return response
        finally:
            if not skip:
                latency_ms = (time.perf_counter() - start) * 1000.0
                endpoint = _normalise_endpoint(request)
                method = request.method
                metrics_module.get_recorder().record(
                    endpoint=endpoint,
                    method=method,
                    status=status_code,
                    latency_ms=latency_ms,
                    degraded=degraded,
                )
                metrics_store.insert_event(
                    endpoint=endpoint,
                    method=method,
                    status=status_code,
                    latency_ms=latency_ms,
                    container_id=metrics_module.get_recorder().container_id,
                    degraded=degraded,
                )
    # CORS: prefer the explicit allow-list from config; only fall back to
    # "*" when nothing was configured (dev). In prod ALLOWED_ORIGINS
    # should always be populated -- log a loud warning if it isn't so
    # the operator notices.
    if not config.ALLOWED_ORIGINS:
        logger.warning(
            "ALLOWED_ORIGINS is empty -- defaulting to '*'. "
            "Set ALLOWED_ORIGINS in the Modal Secret for production."
        )
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

    def _apply_quota(
        response: Response,
        ctx: dict,
        limiter: SlidingWindowLimiter,
    ) -> dict:
        """Shared auth+quota body for the per-tier dependencies.

        Service-token callers (Django -> Modal proxy) bypass the limit;
        they're already throttled per-user upstream by DRF, and double-
        limiting at the edge would punish well-behaved users for sharing
        the proxy. End-user JWTs are limited per ``sub`` claim, so a
        single account can't fan out across tabs to multiply its budget.

        Standard ``X-RateLimit-*`` headers ride on every response (so
        the client can read its remaining budget mid-session), and
        ``Retry-After`` is set on a block so the front-end can back off
        intelligently instead of spinning.
        """
        if not config.RATE_LIMIT_ENABLED:
            return ctx
        key = caller_key(ctx)
        if key is None:
            # Service-token caller -- skip the limiter entirely.
            return ctx
        decision = limiter.check(key)
        headers = decision.as_headers()
        if not decision.allowed:
            # Block path: rely on HTTPException.headers -- response.headers
            # set on the dependency's Response object is discarded by
            # Starlette's exception handler.
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded -- slow down and retry shortly.",
                headers=headers,
            )
        for header_name, header_value in headers.items():
            response.headers[header_name] = header_value
        return ctx

    def require_auth_and_quota(
        response: Response,
        authorization: str | None = Header(default=None),
    ) -> dict:
        """Standard quota for the cheap JSON endpoints (text / recs)."""
        return _apply_quota(response, require_auth(authorization), _rate_limiter)

    def require_auth_and_media_quota(
        request: Request,
        response: Response,
        authorization: str | None = Header(default=None),
    ) -> dict:
        """Stricter quota for the expensive upload endpoints.

        Also performs a *cheap* Content-Length precheck so we reject a
        20-GB upload before Starlette spools its body to disk. The
        in-handler size check on ``file.file.read(MAX_UPLOAD_BYTES+1)``
        still runs as a backstop for chunked uploads with no
        Content-Length.
        """
        cl = request.headers.get("content-length")
        if cl is not None:
            try:
                if int(cl) > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=f"Upload too large (max {MAX_UPLOAD_BYTES} bytes).",
                    )
            except ValueError:
                # Malformed header -- ignore, the in-handler check catches it.
                pass
        return _apply_quota(response, require_auth(authorization), _media_rate_limiter)

    def _safe_stats(label, fn):
        """Defensive wrapper for /health -- a sub-system blowing up must
        not turn /health itself into a 500 (Modal would recycle the
        container, masking the real problem)."""
        try:
            return fn()
        except Exception as exc:  # noqa: BLE001
            logger.exception("Failed to collect %s stats", label)
            return {"error": type(exc).__name__}

    @web_app.get("/", include_in_schema=False)
    def root():
        """Landing JSON for the bare service URL.

        Browsers and curl users hitting the root used to get
        ``{"detail":"Not Found"}`` from FastAPI. Return something
        friendlier with pointers to the docs and the rest of the
        Moodify project so the bare URL is self-describing.
        """
        return {
            "service": "moodify-inference",
            "version": "1.0.0",
            "status": "ok",
            "description": (
                "Moodify ML inference service -- text / speech / face emotion "
                "detection + Deezer-backed music recommendations. Scale-to-zero "
                "FastAPI app on Modal."
            ),
            "links": {
                "openapi_docs": "/docs",
                "redoc":        "/redoc",
                "openapi_json": "/openapi.json",
                "health":       "/health",
                "frontend":     "https://moodify-app.vercel.app",
                "backend_api":  "https://moodify-emotion-music-app-backend.vercel.app",
                "source":       "https://github.com/hoangsonww/Moodify-Emotion-Music-App",
            },
            "endpoints": [
                {"method": "GET",  "path": "/health",
                 "auth": "none", "summary": "Liveness + cache + rate-limit stats."},
                {"method": "POST", "path": "/text_emotion",
                 "auth": "Bearer", "tier": "general",
                 "summary": "Emotion from a piece of text + Deezer recommendations."},
                {"method": "POST", "path": "/speech_emotion",
                 "auth": "Bearer", "tier": "media",
                 "summary": "Emotion from a voice clip (multipart upload <=12MB)."},
                {"method": "POST", "path": "/facial_emotion",
                 "auth": "Bearer", "tier": "media",
                 "summary": "Emotion from a face photo (multipart upload <=12MB)."},
                {"method": "POST", "path": "/music_recommendation",
                 "auth": "Bearer", "tier": "general",
                 "summary": "Mood-matched Deezer tracks + history blend."},
            ],
            "rate_limits": {
                "general": f"{config.RATE_LIMIT_PER_USER}/{int(config.RATE_LIMIT_WINDOW)}s per user",
                "media":   f"{config.RATE_LIMIT_MEDIA_PER_USER}/{int(config.RATE_LIMIT_WINDOW)}s per user",
                "headers": ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Window", "Retry-After (on 429)"],
            },
        }

    @web_app.get("/robots.txt", include_in_schema=False)
    def robots_txt() -> Response:
        """Tell crawlers to stay away from the inference API.

        Crawlers (Google, Bing, archive bots) routinely probe `/robots.txt`
        on any reachable URL. Without this route they get a 404 that wakes
        the container, runs middleware, persists a metric, and otherwise
        wastes scale-to-zero budget. A trivial allow-list-of-nothing
        response keeps the surface area down AND skips the middleware
        (the path is in the metrics middleware skip set already if we
        add it; see below).
        """
        body = "User-agent: *\nDisallow: /\n"
        return Response(
            content=body,
            media_type="text/plain",
            headers={"Cache-Control": "public, max-age=86400"},
        )

    @web_app.get("/favicon.ico", include_in_schema=False)
    def favicon_ico() -> Response:
        """Browsers always probe `/favicon.ico`; return 204 to stop the
        404 noise without serving an actual icon (the public-facing site
        lives elsewhere)."""
        return Response(status_code=204, headers={"Cache-Control": "public, max-age=86400"})

    @web_app.get("/health", response_model=HealthResponse)
    def health(response: Response) -> HealthResponse:
        # /health is the liveness/readiness probe target. It must never
        # 500: a flaky stats call would otherwise prompt Modal to
        # recycle the container, masking the real failure. Each section
        # is wrapped so one bad piece reports "error" and the rest still
        # come through.
        models_loaded = _safe_stats(
            "models_loaded",
            lambda: {
                "text": getattr(text_model, "loaded", False),
                "speech": getattr(speech_model, "loaded", False),
                "facial": getattr(facial_model, "loaded", False),
            },
        )
        caches = {
            "text_emotion": _safe_stats(
                "text_emotion cache", lambda: text_emotion_module.get_cache().stats()
            ),
            "deezer_search": _safe_stats(
                "deezer_search cache", lambda: deezer_module.get_cache().stats()
            ),
            "speech_emotion": _safe_stats(
                "speech_emotion cache", lambda: _speech_cache.stats()
            ),
            "facial_emotion": _safe_stats(
                "facial_emotion cache", lambda: _facial_cache.stats()
            ),
        }
        rate_limit = _safe_stats(
            "rate_limit",
            lambda: {
                "enabled": bool(config.RATE_LIMIT_ENABLED),
                "general": _rate_limiter.stats(),
                "media": _media_rate_limiter.stats(),
            },
        )
        # If any sub-system failed to report, mark the overall status as
        # "degraded" so dashboards/probes can fan out.
        degraded = any(
            isinstance(v, dict) and "error" in v
            for v in (models_loaded, *caches.values(), rate_limit)
        )
        # Don't let CDNs / browsers cache the probe itself.
        response.headers["Cache-Control"] = "no-store"
        return HealthResponse(
            status="degraded" if degraded else "ok",
            models_loaded=models_loaded if isinstance(models_loaded, dict) and "error" not in models_loaded else {},
            caches=caches,
            rate_limit=rate_limit if isinstance(rate_limit, dict) else None,
        )

    def require_admin(authorization: str | None = Header(default=None)) -> dict:
        """FastAPI dependency: admin-only auth for /metrics.

        Accepts ONLY the shared service token, NOT end-user JWTs --
        traffic patterns are operator-only and shouldn't be exposed
        to arbitrary signed-in users.
        """
        try:
            return authenticate_service_only(authorization)
        except AuthError as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc

    @web_app.get("/metrics")
    def metrics(
        window: str = "1h",
        endpoint: str | None = None,
        _ctx: dict = Depends(require_admin),
    ):
        """SRE telemetry -- error rates + latency percentiles + throughput.

        ``window`` accepts: ``5m``, ``15m``, ``1h``, ``6h``, ``24h``,
        ``7d``, ``30d`` (default ``1h``). ``endpoint`` optionally
        narrows the result to one path template (e.g.
        ``/text_emotion``).

        Response shape:

        ```json
        {
          "window": {"label": "1h", "since": "...", "until": "...", "seconds": 3600},
          "service": "modal",
          "persisted": {
            "available": true,
            "endpoints": [
              {"endpoint": "/text_emotion", "method": "POST",
               "count": 412, "error_count": 3, "error_rate": 0.0073,
               "latency_ms": {"p50": 102, "p95": 245, "p99": 412, "max": 891, "mean": 134, "samples": 412},
               "status_codes": {"200": 409, "401": 2, "500": 1}}
            ]
          },
          "live": { "container": "...", "uptime_seconds": 412.5, "endpoints": [...] }
        }
        ```

        The ``persisted`` block aggregates across every container that
        wrote into the window (the real SRE answer). The ``live`` block
        is just the calling container's in-process counters -- handy
        for verifying behaviour right now without waiting for the next
        Mongo aggregation tick.
        """
        persisted = metrics_store.aggregate_window(window=window, endpoint=endpoint)
        live = metrics_module.get_recorder().snapshot()
        return {
            "service": "modal",
            "window": persisted.get("window", {"label": window}),
            "persisted": persisted,
            "live": live,
        }

    @web_app.post("/text_emotion", response_model=EmotionResponse)
    def text_emotion(
        body: TextEmotionRequest,
        response: Response,
        _ctx: dict = Depends(require_auth_and_quota),
    ):
        emotion, degraded = _detect(
            text_model, "text", lambda: (text_model.predict(body.text), False)
        )
        if degraded:
            # Surfaced for the metrics middleware -- not part of the
            # public response contract.
            response.headers["X-Moodify-Degraded"] = "1"
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
                body.emotion, body.market, body.history, body.genre
            ),
        )

    def _infer_from_upload(
        file: UploadFile, model, name: str, media_cache: TTLCache,
        response: Response | None = None,
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
                # Capture the temp path BEFORE writing so a write failure
                # mid-block still hits the finally cleanup branch.
                tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
                tmp_path = tmp.name
                try:
                    try:
                        tmp.write(data)
                    finally:
                        tmp.close()
                    emotion, degraded = _detect(
                        model,
                        name,
                        lambda: (lambda r: (r.emotion, r.degraded))(model.predict(tmp_path)),
                    )
                finally:
                    if tmp_path and os.path.exists(tmp_path):
                        try:
                            os.unlink(tmp_path)
                        except OSError:
                            logger.warning("Failed to delete tmp upload %s", tmp_path)
                # Only memoise successful, non-degraded inferences so a
                # transient failure (e.g. ffmpeg hiccup) doesn't get
                # locked in for the next TTL window.
                if not degraded:
                    media_cache.set(content_key, emotion)

        if degraded and response is not None:
            response.headers["X-Moodify-Degraded"] = "1"
        return EmotionResponse(
            emotion=emotion,
            recommendations=get_music_recommendation(emotion),
            degraded=degraded,
        )

    @web_app.post("/speech_emotion", response_model=EmotionResponse)
    def speech_emotion(
        response: Response,
        file: UploadFile = File(...),
        _ctx: dict = Depends(require_auth_and_media_quota),
    ):
        return _infer_from_upload(file, speech_model, "speech", _speech_cache, response)

    @web_app.post("/facial_emotion", response_model=EmotionResponse)
    def facial_emotion(
        response: Response,
        file: UploadFile = File(...),
        _ctx: dict = Depends(require_auth_and_media_quota),
    ):
        return _infer_from_upload(file, facial_model, "facial", _facial_cache, response)

    return web_app
