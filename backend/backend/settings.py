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

# --- Applications ---------------------------------------------------------
# No admin/sessions/messages/allauth. django.contrib.auth + contenttypes are
# kept INSTALLED (but unused and never queried) only because DRF and
# drf-yasg import from them; there is no SQL database, and authentication is
# JWT-only against the mongoengine User document.
INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "drf_yasg",
    "api",
    "users",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "backend.urls"
WSGI_APPLICATION = "backend.wsgi.application"

# No SQL database. Django 5 permits an empty DATABASES mapping.
DATABASES = {}

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
            ],
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
    X_FRAME_OPTIONS = "DENY"

# --- Swagger / drf-yasg ---------------------------------------------------
SWAGGER_SETTINGS = {
    "USE_SESSION_AUTH": False,
    "SECURITY_DEFINITIONS": {
        "Bearer": {
            "type": "apiKey",
            "in": "header",
            "name": "Authorization",
            "description": "Enter your token in the format: Bearer {access_token}",
        }
    },
    "APIS_SORTER": "alpha",
    "OPERATIONS_SORTER": "alpha",
}

# --- I18N / static --------------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")
# Serve static via the staticfiles finders so swagger assets work on a
# read-only serverless filesystem even without a collectstatic step.
WHITENOISE_USE_FINDERS = True
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
