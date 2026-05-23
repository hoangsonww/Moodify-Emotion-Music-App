"""``GET /api/metrics/`` -- admin-only SRE dashboard data source.

Auth model: matches the Modal ``/metrics`` endpoint -- service token
only, NOT user JWTs. Traffic patterns are operator-visible only. The
shared admin secret comes from the ``ADMIN_METRICS_TOKEN`` setting
(falls back to ``MODAL_SERVICE_TOKEN`` so a single secret unlocks
both services' /metrics surfaces).
"""

from __future__ import annotations

import hmac

from django.conf import settings
from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from backend.api_docs import Tags, _obj, error_response

from . import recorder as recorder_module
from . import store as store_module


def _admin_token() -> str:
    """The shared admin secret. Looked up at call time so tests can
    monkeypatch settings between cases."""
    return (
        getattr(settings, "ADMIN_METRICS_TOKEN", "")
        or getattr(settings, "MODAL_SERVICE_TOKEN", "")
        or ""
    )


def _is_admin(request) -> bool:
    header = request.META.get("HTTP_AUTHORIZATION", "") or ""
    if not header.startswith("Bearer "):
        return False
    token = header.removeprefix("Bearer ").strip()
    expected = _admin_token()
    if not expected:
        return False
    return hmac.compare_digest(token, expected)


_METRICS_RESPONSE = _obj(
    properties={
        "service": openapi.Schema(type=openapi.TYPE_STRING, example="django"),
        "window": openapi.Schema(type=openapi.TYPE_OBJECT),
        "persisted": openapi.Schema(type=openapi.TYPE_OBJECT),
        "live": openapi.Schema(type=openapi.TYPE_OBJECT),
    },
)


@swagger_auto_schema(
    method="get",
    tags=[Tags.SYSTEM],
    operation_summary="SRE metrics (admin only)",
    operation_description=(
        "Aggregated request count, error rate, and latency p50/p95/p99 "
        "for the Django backend over a configurable window.\n\n"
        "Auth: **service token only** (`Authorization: Bearer "
        "<ADMIN_METRICS_TOKEN>`). Falls back to `MODAL_SERVICE_TOKEN` "
        "if the dedicated admin token isn't set, so the same secret "
        "unlocks both backends' `/metrics` surfaces.\n\n"
        "Returns:\n"
        "* `persisted` -- aggregates the last N minutes/hours of "
        "events from the Mongo time-series collection.\n"
        "* `live` -- the calling container's in-memory counters "
        "since startup, useful for verifying what's happening right "
        "now without waiting for the next Mongo write to settle."
    ),
    manual_parameters=[
        openapi.Parameter(
            name="window", in_=openapi.IN_QUERY, type=openapi.TYPE_STRING,
            required=False, default="1h",
            enum=["5m", "15m", "1h", "6h", "24h", "7d", "30d"],
            description="Aggregation window. Unknown values fall back to `1h`.",
        ),
        openapi.Parameter(
            name="endpoint", in_=openapi.IN_QUERY, type=openapi.TYPE_STRING,
            required=False,
            description="Optional endpoint filter (e.g. `/users/login/`).",
        ),
    ],
    responses={
        200: openapi.Response(description="Aggregated + live metrics.",
                              schema=_METRICS_RESPONSE),
        401: error_response("Missing or non-admin Authorization header.",
                            "Service-token authentication required."),
    },
)
@api_view(["GET"])
@authentication_classes([])  # bypass MongoJWTAuthentication -- we check our own admin token
@permission_classes([AllowAny])
def metrics(request):
    if not _is_admin(request):
        return Response(
            {"error": "Service-token authentication required."},
            status=status.HTTP_401_UNAUTHORIZED,
        )
    window = request.GET.get("window", "1h")
    endpoint = request.GET.get("endpoint") or None
    persisted = store_module.aggregate_window(window=window, endpoint=endpoint)
    live = recorder_module.get_recorder().snapshot()
    return Response({
        "service": "django",
        "window": persisted.get("window", {"label": window}),
        "persisted": persisted,
        "live": live,
    })
