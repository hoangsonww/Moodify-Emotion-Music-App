"""Django settings for the Moodify API.

Production target: Vercel serverless. There is no SQL database -- all
persistence is in MongoDB Atlas via mongoengine, and authentication is
stateless JWT (see users/authentication.py). See
docs/PRODUCTION_REFACTOR_PLAN.md for the full architecture.
"""

import os
from pathlib import Path

from decouple import config
from mongoengine import connect

BASE_DIR = Path(__file__).resolve().parent.parent

# --- Core -----------------------------------------------------------------
SECRET_KEY = config("SECRET_KEY", default="django-insecure-dev-key-change-me")
DEBUG = config("DEBUG", default=False, cast=bool)
ALLOWED_HOSTS = [h.strip() for h in config("ALLOWED_HOSTS", default="*").split(",") if h.strip()]

# Shared HS256 key: Django signs end-user JWTs with it; the Modal inference
# service verifies them with the same key. Keep it in sync across both.
JWT_SIGNING_KEY = config("JWT_SIGNING_KEY", default=SECRET_KEY)

# --- Error monitoring (Sentry) --------------------------------------------
# Streams unhandled exceptions + a sampled slice of performance traces to
# Sentry (project: unc-a4/moodify-app). Entirely opt-in: with no SENTRY_DSN
# the SDK never initializes, so local dev and CI stay fully offline. The
# [django] extra auto-wires request/exception capture -- no middleware edits.
_SENTRY_DSN = config("SENTRY_DSN", default="")
if _SENTRY_DSN:
    import sentry_sdk

    sentry_sdk.init(
        dsn=_SENTRY_DSN,
        # Label events by deploy stage; falls back to DEBUG when unset.
        environment=config(
            "SENTRY_ENVIRONMENT",
            default="development" if DEBUG else "production",
        ),
        # Git SHA / version tag for regression tracking (auto-detected if unset).
        release=config("SENTRY_RELEASE", default=None),
        # Fraction of requests captured as performance transactions. 10% keeps
        # trace volume (and quota) sane under real traffic; raise for debugging.
        traces_sample_rate=config("SENTRY_TRACES_SAMPLE_RATE", default=0.1, cast=float),
        # Do NOT attach user id / IP / cookies unless explicitly opted in --
        # this API handles auth material, so default to privacy-preserving.
        send_default_pii=config("SENTRY_SEND_PII", default=False, cast=bool),
    )

# --- MongoDB (the only datastore) -----------------------------------------
# connect() is lazy -- it does not open a socket until the first query.
# maxPoolSize is kept small: on a serverless host each instance keeps its
# own pool, so a large pool x many instances would exhaust Atlas's
# connection limit.
_MONGO_URI = config("MONGO_DB_URI", default="")
_MONGO_KWARGS = dict(
    uuidRepresentation="standard",
    maxPoolSize=config("MONGO_MAX_POOL_SIZE", default=10, cast=int),
    serverSelectionTimeoutMS=config("MONGO_SERVER_SELECTION_TIMEOUT_MS", default=5000, cast=int),
    retryWrites=True,
)
if _MONGO_URI:
    connect(
        db=config("MONGO_DB_NAME", default="emotion_based_music_db"),
        host=_MONGO_URI,
        username=config("MONGO_DB_USERNAME", default=None),
        password=config("MONGO_DB_PASSWORD", default=None),
        authentication_source="admin",
        ssl=True,
        **_MONGO_KWARGS,
    )
else:
    # Local development / CI fallback.
    connect(
        db="emotion_based_music_db",
        host="mongodb://localhost:27017/emotion_based_music_db",
        **_MONGO_KWARGS,
    )

# --- SRE metrics persistence ----------------------------------------------
# Per-request synchronous writes to a Mongo time-series collection; see
# observability/store.py for the design. Disabled in test envs that don't
# want network I/O; the middleware no-ops cleanly.
METRICS_ENABLED = config("METRICS_ENABLED", default=True, cast=bool)
MONGO_DB_NAME = config("MONGO_DB_NAME", default="emotion_based_music_db")
METRICS_COLLECTION = config("METRICS_COLLECTION", default="backend_metrics")
METRICS_TTL_DAYS = config("METRICS_TTL_DAYS", default=30, cast=int)

# Service token that unlocks GET /api/metrics/ -- separate from the
# user-facing JWT so traffic patterns are operator-only. Falls back to
# MODAL_SERVICE_TOKEN so the same secret unlocks both /metrics surfaces.
ADMIN_METRICS_TOKEN = config(
    "ADMIN_METRICS_TOKEN",
    default=config("MODAL_SERVICE_TOKEN", default=""),
)
MODAL_SERVICE_TOKEN = config("MODAL_SERVICE_TOKEN", default="")

# --- Applications ---------------------------------------------------------
# By default there is no admin/sessions/messages/allauth -- production runs
# on Vercel with no SQL database, and authentication is JWT-only against the
# mongoengine User document. django.contrib.auth + contenttypes are kept
# INSTALLED (but unused and never queried) only because DRF and drf-yasg
# import from them.
#
# The classic Django admin (`python manage.py createsuperuser` +
# `/admin/`) is available LOCALLY by opting in with `ENABLE_ADMIN=True`
# (or any truthy DEBUG run). When opted in, the admin app, its prereqs
# (`auth`, `sessions`, `messages`), the matching middleware, a SQLite
# database for the superuser table, and the `/admin/` URL mount are all
# loaded. None of this ships to Vercel unless the env var is set.
# decouple's ``cast=bool`` runs ``bool(value)``, which treats EVERY
# non-empty string as True (including the literal "False"). Pass the
# default already as a real bool so the fallback respects DEBUG honestly.
ENABLE_ADMIN = config("ENABLE_ADMIN", default=DEBUG, cast=bool)

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "drf_yasg",
    "api",
    "users",
    "observability",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    # Metrics LAST so it observes the FULL request lifecycle (including
    # CORS preflight handling, security headers, etc.). The middleware
    # is fully defensive -- a metrics failure can never break a request.
    "observability.middleware.MetricsMiddleware",
]

ROOT_URLCONF = "backend.urls"
WSGI_APPLICATION = "backend.wsgi.application"

# No SQL database in production. Django 5 permits an empty DATABASES mapping.
DATABASES = {}

if ENABLE_ADMIN:
    # Local admin path -- enable Django admin + its hard dependencies and
    # back them with a tiny SQLite file. SQLite lives at the repo root
    # alongside manage.py so `createsuperuser` lands in a known place.
    INSTALLED_APPS = [
        "django.contrib.admin",
        "django.contrib.auth",
        "django.contrib.contenttypes",
        "django.contrib.sessions",
        "django.contrib.messages",
        "django.contrib.staticfiles",
        "rest_framework",
        "corsheaders",
        "drf_yasg",
        "api",
        "users",
        "observability",
    ]

    # Insert session + auth + messages middleware right after security so
    # they wrap the admin views the same way Django's startproject does.
    # csrf goes BEFORE auth, message middleware goes LAST of the trio.
    _admin_extra_mw = [
        "django.contrib.sessions.middleware.SessionMiddleware",
        "django.middleware.csrf.CsrfViewMiddleware",
        "django.contrib.auth.middleware.AuthenticationMiddleware",
        "django.contrib.messages.middleware.MessageMiddleware",
    ]
    _security_idx = MIDDLEWARE.index(
        "django.middleware.security.SecurityMiddleware"
    )
    # Insert immediately AFTER SecurityMiddleware so the chain reads:
    # Security -> Whitenoise -> Sessions -> Csrf -> Auth -> Messages -> ...
    MIDDLEWARE = (
        MIDDLEWARE[: _security_idx + 2]  # Security + WhiteNoise stay first
        + _admin_extra_mw
        + MIDDLEWARE[_security_idx + 2 :]
    )

    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

    # Admin templates need the `request` + `auth` + `messages` context
    # processors; add them only when the admin is on.
    TEMPLATES_CONTEXT_PROCESSORS_EXTRA = [
        "django.contrib.auth.context_processors.auth",
        "django.contrib.messages.context_processors.messages",
    ]

_TEMPLATE_CONTEXT_PROCESSORS = [
    "django.template.context_processors.debug",
    "django.template.context_processors.request",
]
if ENABLE_ADMIN:
    # Admin templates need `auth` (for `user` / `perms`) and `messages`
    # (for the flash bar after a save). Add them only when the admin is on.
    _TEMPLATE_CONTEXT_PROCESSORS += [
        "django.contrib.auth.context_processors.auth",
        "django.contrib.messages.context_processors.messages",
    ]

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": _TEMPLATE_CONTEXT_PROCESSORS,
        },
    },
]

# --- REST framework -------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "users.authentication.MongoJWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": config("THROTTLE_ANON", default="60/min"),
        "user": config("THROTTLE_USER", default="240/min"),
    },
}

# JWT lifetimes (consumed by users/tokens.py).
JWT_ACCESS_TOKEN_DAYS = config("JWT_ACCESS_TOKEN_DAYS", default=7, cast=int)
JWT_REFRESH_TOKEN_DAYS = config("JWT_REFRESH_TOKEN_DAYS", default=14, cast=int)

# --- WebAuthn / passkeys (consumed by users/passkey_views.py) -------------
# A passkey is bound to a Relying Party (RP) identified by a domain. The
# RP ID MUST be the registrable domain the USER's browser is on -- i.e. the
# FRONTEND origin, not this API's host. The browser refuses a ceremony when
# the page origin is not same-site with the RP ID, so for split
# frontend/backend deploys these must point at the frontend.
#
#   WEBAUTHN_RP_ID          bare domain, no scheme/port  (e.g. moodify-app.vercel.app)
#   WEBAUTHN_RP_NAME        human label shown in the OS passkey sheet
#   WEBAUTHN_EXPECTED_ORIGINS  comma-separated full origins allowed to finish
#                              a ceremony (scheme + host + optional port). Supports
#                              several so prod + localhost dev can share a build.
#   WEBAUTHN_CHALLENGE_TTL_SECONDS  how long a begun ceremony stays valid.
WEBAUTHN_RP_ID = config("WEBAUTHN_RP_ID", default="localhost")
WEBAUTHN_RP_NAME = config("WEBAUTHN_RP_NAME", default="Moodify")
WEBAUTHN_EXPECTED_ORIGINS = [
    o.strip()
    for o in config(
        "WEBAUTHN_EXPECTED_ORIGINS",
        default="http://localhost:3000,http://localhost:3001",
    ).split(",")
    if o.strip()
]
WEBAUTHN_CHALLENGE_TTL_SECONDS = config(
    "WEBAUTHN_CHALLENGE_TTL_SECONDS", default=300, cast=int
)

# --- ML inference service (Modal) -----------------------------------------
MODAL_INFERENCE_URL = config("MODAL_INFERENCE_URL", default="")
MODAL_SERVICE_TOKEN = config("MODAL_SERVICE_TOKEN", default="")

# --- CORS -----------------------------------------------------------------
# All origins are allowed by default: the API is public and authenticates
# via a JWT in the Authorization header (not cookies). To lock it down
# later, set CORS_ALLOW_ALL_ORIGINS=False and provide CORS_ALLOWED_ORIGINS.
CORS_ALLOW_ALL_ORIGINS = config("CORS_ALLOW_ALL_ORIGINS", default=True, cast=bool)
CORS_ALLOWED_ORIGINS = [
    o.strip() for o in config("CORS_ALLOWED_ORIGINS", default="").split(",") if o.strip()
]
# Must stay False while all origins are allowed -- the CORS spec forbids
# "Access-Control-Allow-Origin: *" together with credentials. Header-based
# JWT auth does not need credentialed (cookie) requests.
CORS_ALLOW_CREDENTIALS = False
CORS_ALLOW_HEADERS = ["Authorization", "Content-Type", "X-CSRFToken"]
CORS_ALLOW_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]

# --- Caching --------------------------------------------------------------
# Per-instance local memory by default. Point CACHE_REDIS_URL at a
# serverless Redis (e.g. Upstash, rediss://) for a shared cache.
_REDIS_URL = config("CACHE_REDIS_URL", default="")
if _REDIS_URL:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": _REDIS_URL,
        }
    }
else:
    CACHES = {
        "default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}
    }

# --- Security (production hardening) --------------------------------------
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
if not DEBUG:
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    X_FRAME_OPTIONS = "DENY"

# `manage.py check --deploy` warnings that do not apply to this deployment:
#  - security.W003 (CSRF middleware): this is a stateless JWT API. Auth
#    travels in the Authorization header, never in cookies, so there is no
#    CSRF attack surface and CsrfViewMiddleware is intentionally omitted.
#  - security.W008 (SSL redirect): HTTPS is terminated and enforced at the
#    hosting edge (Vercel / Render); a Django-level redirect is redundant.
SILENCED_SYSTEM_CHECKS = ["security.W003", "security.W008"]

# --- Swagger / drf-yasg ---------------------------------------------------
SWAGGER_SETTINGS = {
    "USE_SESSION_AUTH": False,
    "SECURITY_DEFINITIONS": {
        "Bearer": {
            "type": "apiKey",
            "in": "header",
            "name": "Authorization",
            "description": "JWT access token from `/users/login/`. Format: `Bearer <token>`.",
        }
    },
    # ``alpha`` was sorting the tags alphabetically (api, users) which is
    # exactly what the new tag taxonomy is replacing. Disable sorting so
    # the tag order is the one our schema generator emits.
    "APIS_SORTER": None,
    "OPERATIONS_SORTER": "method",
    "DOC_EXPANSION": "list",
    "DEEP_LINKING": True,
    "DISPLAY_OPERATION_ID": False,
    "DEFAULT_MODEL_RENDERING": "example",
    "DEFAULT_MODEL_DEPTH": 4,
    "PERSIST_AUTH": True,
    "REFETCH_SCHEMA_WITH_AUTH": True,
}

# --- I18N / static --------------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")
# Use the finders so any remaining static asset is served straight from
# the source tree -- the API itself does not ship any (the Swagger / Redoc
# UI and favicon all load from a CDN, see backend/swagger.py), but this
# keeps the admin / DRF browsable API working on a serverless filesystem
# even without a collectstatic step.
WHITENOISE_USE_FINDERS = True
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
