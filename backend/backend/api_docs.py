"""Centralised drf-yasg schema helpers for Moodify's OpenAPI docs.

This module owns the "shape" of every endpoint shown in Swagger / Redoc:

* **TAGS** -- the eight logical groups that show up in the sidebar
  (Authentication, Password reset, Profile, Mood history, ...). Each
  one has a short description so the docs read as a guided tour, not
  a flat dump of URL paths.
* **Common parameter / body builders** -- ``user_id_param``,
  ``credentials_body``, etc. so we don't repeat the same five lines
  of ``openapi.Schema(...)`` across a dozen views.
* **Common response builders** -- ``error_response``, ``ok_response``
  -- giving every 4xx the same JSON shape (``{"error": "..."}``) and
  every 2xx a real example payload (Redoc only renders examples that
  are *attached* to the response, not the schema).
* **SCHEMA_HEADER** -- the long-form Markdown intro shown above the
  endpoint list on Swagger UI / Redoc. Covers auth flow, rate limit
  story, link to the Modal inference docs, etc.
* **MoodifySchemaGenerator** -- a tiny drf-yasg ``OpenAPISchemaGenerator``
  subclass that injects the tag-level descriptions into the generated
  schema (drf-yasg doesn't ship a built-in way to set tag descriptions
  via the ``Info`` block alone).

Importing this module has no side effects beyond defining constants;
``schema_view`` in ``swagger.py`` is what actually mounts the schema.
"""

from __future__ import annotations

from drf_yasg import openapi
from drf_yasg.generators import OpenAPISchemaGenerator


# ---------------------------------------------------------------------------
# Tag taxonomy
# ---------------------------------------------------------------------------
# Each endpoint declares a single tag via ``swagger_auto_schema(tags=[...])``;
# the order here drives the sidebar order in Swagger UI / Redoc. Names are
# Title-Case (NOT lowercase URL fragments) because the sidebar shows them
# verbatim and "Authentication" reads a lot better than "users".

class Tags:
    AUTH = "Authentication"
    PASSWORD_RESET = "Password Reset"
    PROFILE = "Profile"
    MOOD_HISTORY = "Mood History"
    LISTENING_HISTORY = "Listening History"
    SAVED_RECOMMENDATIONS = "Saved Recommendations"
    INFERENCE = "Emotion Inference"
    MUSIC = "Music Recommendations"
    SYSTEM = "System"


# Ordered list of (name, description) pairs used by the schema generator
# below to attach tag-level descriptions to the generated OpenAPI doc.
TAGS: list[dict[str, str]] = [
    {
        "name": Tags.AUTH,
        "description": (
            "Create accounts, sign in, refresh tokens, and validate a session. "
            "All authenticated endpoints expect a `Authorization: Bearer "
            "<access-token>` header; access tokens live for 7 days, refresh "
            "tokens for 14."
        ),
    },
    {
        "name": Tags.PASSWORD_RESET,
        "description": (
            "Two-step self-service password reset: first prove identity with "
            "the username/email pair, then post a new password. There is no "
            "email magic link in this build -- the flow is purely API-driven "
            "so it works from web, mobile, and CLI clients identically."
        ),
    },
    {
        "name": Tags.PROFILE,
        "description": (
            "Read, update, and permanently delete the signed-in user's "
            "profile. The profile owns the user's mood / listening / saved-"
            "recommendation histories; deleting the profile cascades to all "
            "three."
        ),
    },
    {
        "name": Tags.MOOD_HISTORY,
        "description": (
            "Append-only log of detected moods (one entry per `/text_emotion` "
            "/ `/speech_emotion` / `/facial_emotion` call the user runs). "
            "Powers the recurring-mood blend in the personalised "
            "recommender. Wipe individual entries or the whole list."
        ),
    },
    {
        "name": Tags.LISTENING_HISTORY,
        "description": (
            "Tracks the user has opened from a recommendation. Used by the "
            "client to dim already-heard tracks and (longer-term) to bias "
            "the recommender against duplicates."
        ),
    },
    {
        "name": Tags.SAVED_RECOMMENDATIONS,
        "description": (
            "Each user can pin tracks from the live recommender into a "
            "persistent \"saved\" list. Two URL shapes exist for backwards "
            "compatibility: the single multi-method `/recommendations/{id}/` "
            "and the three split `/recommendations/{save,get,delete}/{id}/` "
            "endpoints -- they're equivalent."
        ),
    },
    {
        "name": Tags.INFERENCE,
        "description": (
            "Text -> emotion proxy to the Modal inference service. Speech "
            "and facial uploads are intentionally NOT proxied here; the "
            "web / mobile clients call Modal directly with the user's own "
            "JWT to avoid round-tripping multi-megabyte uploads through "
            "Vercel's request body cap."
        ),
    },
    {
        "name": Tags.MUSIC,
        "description": (
            "Mood-matched Deezer track lookup, with optional history blend "
            "for personalisation. Proxied through Django so anonymous "
            "clients can still hit it (the Modal endpoint requires a JWT)."
        ),
    },
    {
        "name": Tags.SYSTEM,
        "description": (
            "Liveness / readiness probe used by uptime monitors and the "
            "Vercel deploy health check."
        ),
    },
]


# ---------------------------------------------------------------------------
# Common parameters
# ---------------------------------------------------------------------------
def user_id_param(description: str = "Mongo ObjectId of the target user profile.") -> openapi.Parameter:
    return openapi.Parameter(
        name="user_id",
        in_=openapi.IN_PATH,
        type=openapi.TYPE_STRING,
        required=True,
        description=description,
        example="65f3a1b2c4d5e6f7a8b9c0d1",
    )


# Security: bearer auth indicator (drf-yasg picks this up from
# ``SECURITY_DEFINITIONS`` in settings.SWAGGER_SETTINGS too, but having
# it ready as a manual param helper is convenient for completeness).
def bearer_auth_param() -> openapi.Parameter:
    return openapi.Parameter(
        name="Authorization",
        in_=openapi.IN_HEADER,
        type=openapi.TYPE_STRING,
        required=True,
        description="`Bearer <access token>` -- short-lived JWT from `/users/login/`.",
        example="Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    )


# ---------------------------------------------------------------------------
# Common schemas
# ---------------------------------------------------------------------------
def _obj(properties: dict, required: list[str] | None = None, example: dict | None = None,
         description: str | None = None) -> openapi.Schema:
    """Tight wrapper around openapi.Schema(type=OBJECT, ...).

    Always pins a real example onto the schema so Swagger UI shows
    something other than ``"string"`` placeholders.
    """
    return openapi.Schema(
        type=openapi.TYPE_OBJECT,
        properties=properties,
        required=required or [],
        example=example,
        description=description,
    )


STRING = openapi.Schema(type=openapi.TYPE_STRING)
INTEGER = openapi.Schema(type=openapi.TYPE_INTEGER)
BOOLEAN = openapi.Schema(type=openapi.TYPE_BOOLEAN)
ARRAY_OF_STRINGS = openapi.Schema(type=openapi.TYPE_ARRAY, items=openapi.Items(type=openapi.TYPE_STRING))


# A single track as returned by the recommender -- matches the Modal
# inference EmotionResponse shape.
TRACK_SCHEMA = _obj(
    properties={
        "name":         openapi.Schema(type=openapi.TYPE_STRING, example="Blinding Lights"),
        "artist":       openapi.Schema(type=openapi.TYPE_STRING, example="The Weeknd"),
        "album":        openapi.Schema(type=openapi.TYPE_STRING, example="After Hours"),
        "preview_url":  openapi.Schema(type=openapi.TYPE_STRING, format="uri",
                                       example="https://cdns-preview-1.dzcdn.net/.../preview.mp3"),
        "external_url": openapi.Schema(type=openapi.TYPE_STRING, format="uri",
                                       example="https://www.deezer.com/track/916424"),
        "image_url":    openapi.Schema(type=openapi.TYPE_STRING, format="uri",
                                       example="https://cdns-images.dzcdn.net/.../250x250.jpg"),
        "popularity":   openapi.Schema(type=openapi.TYPE_INTEGER, example=92),
        "duration_ms":  openapi.Schema(type=openapi.TYPE_INTEGER, example=200000),
        "release_date": openapi.Schema(type=openapi.TYPE_STRING, nullable=True, example=None),
    },
)


ARRAY_OF_TRACKS = openapi.Schema(type=openapi.TYPE_ARRAY, items=TRACK_SCHEMA)


# Standard error envelope -- every 4xx / 5xx uses this shape.
ERROR_SCHEMA = _obj(
    properties={"error": openapi.Schema(type=openapi.TYPE_STRING, example="Invalid credentials.")},
    required=["error"],
)

# Standard "operation succeeded" envelope -- every 2xx that doesn't return
# a body of its own uses this.
MESSAGE_SCHEMA = _obj(
    properties={"message": openapi.Schema(type=openapi.TYPE_STRING, example="Operation completed successfully.")},
    required=["message"],
)


# ---------------------------------------------------------------------------
# Response builders
# ---------------------------------------------------------------------------
def error_response(description: str, example_error: str) -> openapi.Response:
    """Helper for a 4xx with the canonical ``{"error": "..."}`` envelope."""
    return openapi.Response(
        description=description,
        schema=ERROR_SCHEMA,
        examples={"application/json": {"error": example_error}},
    )


def ok_message(description: str, message: str) -> openapi.Response:
    """Helper for a 2xx with the canonical ``{"message": "..."}`` envelope."""
    return openapi.Response(
        description=description,
        schema=MESSAGE_SCHEMA,
        examples={"application/json": {"message": message}},
    )


# Frequently-reused responses -- keeps the per-view ``responses=`` dict tiny.
RESP_401 = error_response("Missing, invalid or expired access token.", "Authentication credentials were not provided.")
RESP_403 = error_response("Authenticated but the resource does not belong to the caller.", "Forbidden.")
RESP_404_USER = error_response("No such user / profile.", "User not found.")
RESP_429 = error_response(
    "Rate limit exceeded -- the calling client is throttled by DRF (60/min anon, 240/min user).",
    "Request was throttled. Expected available in 30 seconds.",
)


# ---------------------------------------------------------------------------
# Top-of-page intro shown by Swagger UI + Redoc
# ---------------------------------------------------------------------------
SCHEMA_HEADER = """
## Overview

REST API for [**Moodify**](https://moodify-emotion-music-app.vercel.app/) --
an emotion-driven music recommendation app. The Django service you're
looking at handles user accounts, profiles, history, and proxies a
subset of ML inference calls. The heavy ML lifting (text / speech /
face emotion detection + the Deezer-backed recommender + the
recency-weighted personalisation model) lives in a separate
[scale-to-zero **Modal**](https://modal.com) service. The two share a
JWT signing key, so the same access token you get from
`/users/login/` works against Modal too -- web and mobile clients
upload audio / images **directly** to Modal to avoid round-tripping
multi-megabyte bodies through Vercel.

## Authentication

```
POST /users/login/                  -> { access, refresh }
Authorization: Bearer <access>      on every authenticated request
POST /users/token/refresh/          -> { access, refresh } when the access expires
```

* **Access tokens** live for 7 days, **refresh tokens** for 14.
* `Authorization` header is the only auth surface -- there are **no
  sessions, no CSRF, no cookies**.
* The same `JWT_SIGNING_KEY` is shared with the Modal inference
  service; one token, one identity, both backends.

## Rate limiting and cost protection

Two layers sit in front of the Modal compute budget:

| Layer | Where | Default |
|---|---|---|
| DRF throttling (`AnonRateThrottle`, `UserRateThrottle`) | Django | `60/min` anon, `240/min` user |
| Sliding-window per-user limit | Modal | `45/min` general, `15/min` media |

Both are tuned to never bite a real user -- only retry loops and
scripted abuse trip them. See the
[modal_inference README](https://github.com/hoangsonww/Moodify-Emotion-Music-App/blob/master/modal_inference/README.md#rate-limiting)
for the full design.

## Conventions

* **Success** responses are either an explicit body (`/users/login/` ->
  `{ access, refresh }`) or the envelope `{"message": "..."}`.
* **Error** responses are always `{"error": "<human-readable>"}` with
  the matching 4xx status code.
* All timestamps are ISO 8601, UTC.
* All IDs are Mongo ObjectIds (24-character hex strings).

## Useful links

* Frontend: <https://moodify-emotion-music-app.vercel.app/>
* Source: <https://github.com/hoangsonww/Moodify-Emotion-Music-App>
* Modal inference service docs: see the `modal_inference/README.md`
"""


# ---------------------------------------------------------------------------
# Schema generator -- injects per-tag descriptions into the output
# ---------------------------------------------------------------------------
class MoodifySchemaGenerator(OpenAPISchemaGenerator):
    """Attach a description to every tag in the generated schema.

    drf-yasg picks up tag *names* automatically from each endpoint's
    ``@swagger_auto_schema(tags=[...])`` declaration, but it has no
    built-in way to attach a description to those tags. Overriding
    ``get_schema`` lets us walk the result and bolt the description
    on after generation.
    """

    def get_schema(self, request=None, public=False):
        schema = super().get_schema(request=request, public=public)
        # Swagger 2.0 (which drf-yasg emits) carries tags at the root.
        # Build a {name: description} map from our taxonomy and merge.
        descriptions = {t["name"]: t["description"] for t in TAGS}
        ordered_tags = [t["name"] for t in TAGS]

        existing = list(getattr(schema, "tags", None) or [])
        # Drop any auto-generated tags whose name we own.
        existing = [t for t in existing if t.get("name") not in descriptions]
        # Prepend our taxonomy (so the order is deterministic in the UI).
        new_tags = [{"name": n, "description": descriptions[n]} for n in ordered_tags]
        schema.tags = new_tags + existing
        return schema
