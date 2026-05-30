"""WebAuthn / passkey endpoints for the users app.

Passkeys are an additional, password-optional authentication factor layered
on top of the existing JWT auth (users/views.py). The cryptographic heavy
lifting -- option generation, attestation/assertion verification, COSE key
handling -- is delegated to the vetted ``webauthn`` (py_webauthn) library;
this module owns the integration: persistence of credentials/challenges,
ownership checks, and turning a verified assertion into the same
``(access, refresh)`` JWT pair ``/users/login/`` issues.

Four ceremonies + three management routes:

  register/begin  + register/complete   (authenticated)  -- enroll a passkey
  login/begin     + login/complete      (public)         -- sign in with one
  GET    passkeys/            (authenticated)  -- list mine
  PATCH  passkeys/<id>/       (authenticated)  -- rename one
  DELETE passkeys/<id>/       (authenticated)  -- remove one

Each ceremony is two requests; the server-issued challenge is persisted as a
single-use ``WebAuthnChallenge`` (see documents.py) and referenced across the
two calls by an opaque ``flowId``.
"""

import json
import logging
from datetime import datetime, timedelta

from django.conf import settings
from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    options_to_json,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers import base64url_to_bytes, bytes_to_base64url
from webauthn.helpers.exceptions import (
    InvalidAuthenticationResponse,
    InvalidRegistrationResponse,
)
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    AuthenticatorTransport,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from backend.api_docs import Tags, error_response, ok_message, _obj

from .documents import User, WebAuthnChallenge, WebAuthnCredential
from .tokens import issue_tokens

logger = logging.getLogger(__name__)

PASSKEY_NAME_MAX_LENGTH = 60
DEFAULT_PASSKEY_NAME = "Passkey"


# ---------------------------------------------------------------------------
# Relying-Party configuration (env-driven; see settings.py).
# ---------------------------------------------------------------------------
def _rp_id() -> str:
    return getattr(settings, "WEBAUTHN_RP_ID", "localhost")


def _rp_name() -> str:
    return getattr(settings, "WEBAUTHN_RP_NAME", "Moodify")


def _expected_origins():
    """Full origins allowed to finish a ceremony.

    ``verify_*`` accepts either a single origin or a list; we always pass the
    configured list so prod + local dev can share one backend build.
    """
    return getattr(settings, "WEBAUTHN_EXPECTED_ORIGINS", ["http://localhost:3000"])


def _challenge_ttl() -> timedelta:
    return timedelta(seconds=getattr(settings, "WEBAUTHN_CHALLENGE_TTL_SECONDS", 300))


# ---------------------------------------------------------------------------
# Challenge persistence helpers.
# ---------------------------------------------------------------------------
def _store_challenge(challenge: bytes, purpose: str, user_id: str | None) -> str:
    """Persist a single-use challenge; return its opaque ``flowId``.

    Opportunistically drops this purpose's already-expired rows so the
    collection can't grow without bound even without a TTL index (indexes
    are managed in Atlas, not auto-created -- see documents.py).
    """
    try:
        WebAuthnChallenge.objects(
            purpose=purpose, expires_at__lt=datetime.utcnow()
        ).delete()
    except Exception:  # noqa: BLE001 -- cleanup is best-effort, never fatal
        logger.debug("Expired-challenge sweep failed", exc_info=True)

    doc = WebAuthnChallenge(
        challenge=bytes_to_base64url(challenge),
        purpose=purpose,
        user_id=user_id,
        expires_at=datetime.utcnow() + _challenge_ttl(),
    ).save()
    return str(doc.id)


def _consume_challenge(flow_id: str, purpose: str):
    """Load + delete (single-use) a challenge by flowId.

    Returns the ``WebAuthnChallenge`` (already deleted from the DB) or
    ``None`` when the flow id is unknown, the purpose mismatches, or the
    challenge has expired.
    """
    try:
        doc = WebAuthnChallenge.objects(id=flow_id, purpose=purpose).first()
    except Exception:  # noqa: BLE001 -- malformed ObjectId -> treat as a miss
        return None
    if doc is None:
        return None
    # Single use: delete regardless of expiry so a stale flow can't be retried.
    doc.delete()
    if doc.is_expired:
        return None
    return doc


# ---------------------------------------------------------------------------
# Serialisation.
# ---------------------------------------------------------------------------
def _iso(dt) -> str | None:
    """ISO-8601 UTC string with a ``Z`` suffix (timestamps are naive UTC)."""
    if dt is None:
        return None
    return dt.replace(microsecond=0).isoformat() + "Z"


def _serialize(cred: WebAuthnCredential) -> dict:
    """Public, non-sensitive view of a passkey for the management UI."""
    return {
        "id": str(cred.id),
        "name": cred.name,
        "transports": cred.transports or [],
        "device_type": cred.device_type,
        "backed_up": bool(cred.backed_up),
        "aaguid": cred.aaguid,
        "created_at": _iso(cred.created_at),
        "last_used_at": _iso(cred.last_used_at),
    }


def _clean_name(raw, fallback: str = DEFAULT_PASSKEY_NAME) -> str:
    """Trim + length-cap a user-supplied passkey label."""
    name = (raw or "").strip()
    if not name:
        return fallback
    return name[:PASSKEY_NAME_MAX_LENGTH]


_VALID_TRANSPORTS = {t.value for t in AuthenticatorTransport}


def _allowed_credentials(user_id: str):
    """``allowCredentials`` descriptors for every passkey a user owns."""
    descriptors = []
    for cred in WebAuthnCredential.objects(user_id=user_id):
        # ``options_to_json`` calls ``.value`` on each transport, so they must
        # be enum members -- coerce the stored strings and drop anything that
        # isn't a recognised transport.
        transports = (
            [AuthenticatorTransport(t) for t in cred.transports if t in _VALID_TRANSPORTS]
            or None
        )
        descriptors.append(
            PublicKeyCredentialDescriptor(
                id=base64url_to_bytes(cred.credential_id),
                transports=transports,
            )
        )
    return descriptors


# ===========================================================================
# Registration ceremony (authenticated): enroll a NEW passkey on the account.
# ===========================================================================
_REGISTER_BEGIN_RESPONSE = _obj(
    properties={
        "options": openapi.Schema(
            type=openapi.TYPE_OBJECT,
            description="`PublicKeyCredentialCreationOptions` (camelCase, base64url challenge/ids) to hand to `navigator.credentials.create()`.",
        ),
        "flowId": openapi.Schema(
            type=openapi.TYPE_STRING,
            description="Opaque id echoed back on `register/complete/`.",
        ),
    },
)


@swagger_auto_schema(
    method="post",
    tags=[Tags.PASSKEYS],
    operation_summary="Begin passkey registration",
    operation_description=(
        "Step 1 of enrolling a passkey for the signed-in user. Returns the "
        "`PublicKeyCredentialCreationOptions` to pass to "
        "`navigator.credentials.create()`, plus an opaque `flowId`. The "
        "user's existing passkeys are listed in `excludeCredentials` so the "
        "same authenticator can't be enrolled twice."
    ),
    responses={200: openapi.Response("Creation options.", schema=_REGISTER_BEGIN_RESPONSE),
               401: error_response("Not signed in.", "Authentication credentials were not provided.")},
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def passkey_register_begin(request):
    """Issue registration options for the authenticated user."""
    user = request.user
    user_id = str(user.id)

    options = generate_registration_options(
        rp_id=_rp_id(),
        rp_name=_rp_name(),
        user_id=user_id.encode("utf-8"),
        user_name=user.username,
        user_display_name=user.username,
        # Resident keys make usernameless ("just tap your phone") login work;
        # PREFERRED keeps roaming keys that can't store one usable too.
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.PREFERRED,
        ),
        exclude_credentials=_allowed_credentials(user_id),
    )

    flow_id = _store_challenge(options.challenge, "registration", user_id)
    return Response({"options": json.loads(options_to_json(options)), "flowId": flow_id})


_REGISTER_COMPLETE_BODY = _obj(
    properties={
        "flowId": openapi.Schema(type=openapi.TYPE_STRING),
        "name": openapi.Schema(type=openapi.TYPE_STRING, example="MacBook Touch ID"),
        "credential": openapi.Schema(
            type=openapi.TYPE_OBJECT,
            description="The `PublicKeyCredential` returned by `navigator.credentials.create()`.",
        ),
    },
    required=["flowId", "credential"],
)


@swagger_auto_schema(
    method="post",
    tags=[Tags.PASSKEYS],
    operation_summary="Complete passkey registration",
    operation_description=(
        "Step 2 of enrolling a passkey. Verifies the attestation against the "
        "challenge from step 1 and stores the credential's public key. An "
        "optional `name` labels the passkey in the management UI."
    ),
    request_body=_REGISTER_COMPLETE_BODY,
    responses={
        201: openapi.Response("Passkey registered."),
        400: error_response("Verification failed / expired flow.", "Could not verify the passkey."),
        401: error_response("Not signed in.", "Authentication credentials were not provided."),
        409: error_response("Authenticator already registered.", "This passkey is already registered."),
    },
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def passkey_register_complete(request):
    """Verify and persist a freshly created passkey."""
    user = request.user
    user_id = str(user.id)

    flow_id = request.data.get("flowId")
    credential = request.data.get("credential")
    if not flow_id or not credential:
        return Response({"error": "flowId and credential are required."},
                        status=status.HTTP_400_BAD_REQUEST)

    challenge = _consume_challenge(flow_id, "registration")
    if challenge is None or challenge.user_id != user_id:
        return Response({"error": "Registration session expired. Please try again."},
                        status=status.HTTP_400_BAD_REQUEST)

    try:
        verification = verify_registration_response(
            credential=json.dumps(credential),
            expected_challenge=base64url_to_bytes(challenge.challenge),
            expected_rp_id=_rp_id(),
            expected_origin=_expected_origins(),
            require_user_verification=False,
        )
    except (InvalidRegistrationResponse, ValueError, KeyError) as exc:
        logger.info("Passkey registration verification failed: %s", exc)
        return Response({"error": "Could not verify the passkey."},
                        status=status.HTTP_400_BAD_REQUEST)

    credential_id = bytes_to_base64url(verification.credential_id)
    if WebAuthnCredential.objects(credential_id=credential_id).first() is not None:
        return Response({"error": "This passkey is already registered."},
                        status=status.HTTP_409_CONFLICT)

    device_type = getattr(verification.credential_device_type, "value",
                          verification.credential_device_type)
    transports = []
    response_blob = credential.get("response") if isinstance(credential, dict) else None
    if isinstance(response_blob, dict) and isinstance(response_blob.get("transports"), list):
        transports = [str(t) for t in response_blob["transports"] if t]

    cred = WebAuthnCredential(
        user_id=user_id,
        username=user.username,
        credential_id=credential_id,
        public_key=bytes_to_base64url(verification.credential_public_key),
        sign_count=verification.sign_count,
        transports=transports,
        aaguid=verification.aaguid,
        device_type=str(device_type) if device_type is not None else None,
        backed_up=bool(verification.credential_backed_up),
        name=_clean_name(request.data.get("name")),
    )
    cred.save()
    return Response({"message": "Passkey registered.", "passkey": _serialize(cred)},
                    status=status.HTTP_201_CREATED)


# ===========================================================================
# Authentication ceremony (public): sign in with a passkey.
# ===========================================================================
_LOGIN_BEGIN_BODY = _obj(
    properties={
        "username": openapi.Schema(
            type=openapi.TYPE_STRING,
            description="Optional. When given, only that account's passkeys are offered; omit for a usernameless (discoverable-credential) prompt.",
        ),
    },
)


@swagger_auto_schema(
    method="post",
    tags=[Tags.PASSKEYS],
    operation_summary="Begin passkey login",
    operation_description=(
        "Step 1 of signing in with a passkey. Returns "
        "`PublicKeyCredentialRequestOptions` for `navigator.credentials.get()` "
        "plus a `flowId`. Pass a `username` to scope the prompt to one "
        "account, or omit it for a usernameless prompt that lets the "
        "authenticator offer any discoverable Moodify passkey. The response "
        "is identical whether or not the username exists, so it never "
        "discloses account existence."
    ),
    request_body=_LOGIN_BEGIN_BODY,
    responses={200: openapi.Response("Request options + flowId.")},
)
@api_view(["POST"])
@permission_classes([AllowAny])
def passkey_login_begin(request):
    """Issue authentication options (optionally scoped to a username)."""
    username = (request.data.get("username") or "").strip()

    allow_credentials = None
    bound_user_id = None
    if username:
        user = User.objects(username=username).first()
        if user is not None and user.is_active:
            bound_user_id = str(user.id)
            allow_credentials = _allowed_credentials(bound_user_id)
        else:
            # Don't disclose non-existence: still return a well-formed
            # challenge with an empty allow-list (the ceremony will simply
            # fail at complete, exactly as a wrong password would).
            allow_credentials = []

    options = generate_authentication_options(
        rp_id=_rp_id(),
        user_verification=UserVerificationRequirement.PREFERRED,
        allow_credentials=allow_credentials,
    )

    flow_id = _store_challenge(options.challenge, "authentication", bound_user_id)
    return Response({"options": json.loads(options_to_json(options)), "flowId": flow_id})


_LOGIN_COMPLETE_BODY = _obj(
    properties={
        "flowId": openapi.Schema(type=openapi.TYPE_STRING),
        "credential": openapi.Schema(
            type=openapi.TYPE_OBJECT,
            description="The `PublicKeyCredential` returned by `navigator.credentials.get()`.",
        ),
    },
    required=["flowId", "credential"],
)


@swagger_auto_schema(
    method="post",
    tags=[Tags.PASSKEYS],
    operation_summary="Complete passkey login",
    operation_description=(
        "Step 2 of signing in with a passkey. Verifies the assertion against "
        "the stored public key and challenge, then returns the same "
        "`(access, refresh)` JWT pair as `/users/login/`. The signature "
        "counter is advanced; a non-increasing counter (possible cloned "
        "authenticator) is rejected."
    ),
    request_body=_LOGIN_COMPLETE_BODY,
    responses={
        200: openapi.Response("Authenticated; returns access + refresh JWTs."),
        400: error_response("Malformed request / expired flow.", "Login session expired. Please try again."),
        401: error_response("Assertion could not be verified.", "Could not verify the passkey."),
    },
)
@api_view(["POST"])
@permission_classes([AllowAny])
def passkey_login_complete(request):
    """Verify a passkey assertion and issue a JWT pair."""
    flow_id = request.data.get("flowId")
    credential = request.data.get("credential")
    if not flow_id or not credential or not isinstance(credential, dict):
        return Response({"error": "flowId and credential are required."},
                        status=status.HTTP_400_BAD_REQUEST)

    challenge = _consume_challenge(flow_id, "authentication")
    if challenge is None:
        return Response({"error": "Login session expired. Please try again."},
                        status=status.HTTP_400_BAD_REQUEST)

    raw_id = credential.get("rawId") or credential.get("id")
    if not raw_id:
        return Response({"error": "Could not verify the passkey."},
                        status=status.HTTP_401_UNAUTHORIZED)

    stored = WebAuthnCredential.objects(credential_id=raw_id).first()
    # If the ceremony was scoped to a username, the resolved credential must
    # belong to that same account -- otherwise it's a mismatched assertion.
    if stored is None or (challenge.user_id and stored.user_id != challenge.user_id):
        return Response({"error": "Could not verify the passkey."},
                        status=status.HTTP_401_UNAUTHORIZED)

    try:
        verification = verify_authentication_response(
            credential=json.dumps(credential),
            expected_challenge=base64url_to_bytes(challenge.challenge),
            expected_rp_id=_rp_id(),
            expected_origin=_expected_origins(),
            credential_public_key=base64url_to_bytes(stored.public_key),
            credential_current_sign_count=stored.sign_count,
            require_user_verification=False,
        )
    except (InvalidAuthenticationResponse, ValueError, KeyError) as exc:
        logger.info("Passkey authentication verification failed: %s", exc)
        return Response({"error": "Could not verify the passkey."},
                        status=status.HTTP_401_UNAUTHORIZED)

    user = User.objects(id=stored.user_id).first()
    if user is None or not user.is_active:
        return Response({"error": "Could not verify the passkey."},
                        status=status.HTTP_401_UNAUTHORIZED)

    stored.sign_count = verification.new_sign_count
    stored.last_used_at = datetime.utcnow()
    stored.backed_up = bool(verification.credential_backed_up)
    if verification.credential_device_type is not None:
        stored.device_type = str(
            getattr(verification.credential_device_type, "value",
                    verification.credential_device_type)
        )
    stored.save()

    body = issue_tokens(user)
    body["username"] = user.username
    return Response(body, status=status.HTTP_200_OK)


# ===========================================================================
# Management (authenticated): list / rename / delete.
# ===========================================================================
@swagger_auto_schema(
    method="get",
    tags=[Tags.PASSKEYS],
    operation_summary="List the signed-in user's passkeys",
    operation_description="Returns every passkey on the account, newest first. No secret material is included.",
    responses={200: openapi.Response("The user's passkeys."),
               401: error_response("Not signed in.", "Authentication credentials were not provided.")},
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def passkey_list(request):
    """List all passkeys owned by the authenticated user."""
    creds = WebAuthnCredential.objects(user_id=str(request.user.id)).order_by("-created_at")
    return Response({"passkeys": [_serialize(c) for c in creds]})


_RENAME_BODY = _obj(
    properties={"name": openapi.Schema(type=openapi.TYPE_STRING, example="Work laptop")},
    required=["name"],
)


@swagger_auto_schema(
    method="patch",
    tags=[Tags.PASSKEYS],
    operation_summary="Rename a passkey",
    operation_description="Updates the friendly label of one of the caller's passkeys.",
    request_body=_RENAME_BODY,
    responses={
        200: openapi.Response("Renamed."),
        400: error_response("Empty name.", "A name is required."),
        401: error_response("Not signed in.", "Authentication credentials were not provided."),
        404: error_response("No such passkey for this user.", "Passkey not found."),
    },
)
@swagger_auto_schema(
    method="delete",
    tags=[Tags.PASSKEYS],
    operation_summary="Delete a passkey",
    operation_description=(
        "Permanently removes one of the caller's passkeys. The user can still "
        "sign in with their password (and any remaining passkeys)."
    ),
    responses={
        200: ok_message("Deleted.", "Passkey removed."),
        401: error_response("Not signed in.", "Authentication credentials were not provided."),
        404: error_response("No such passkey for this user.", "Passkey not found."),
    },
)
@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def passkey_detail(request, passkey_id):
    """Rename (PATCH) or delete (DELETE) a single passkey the caller owns."""
    try:
        cred = WebAuthnCredential.objects(id=passkey_id).first()
    except Exception:  # noqa: BLE001 -- malformed ObjectId -> treat as a miss
        cred = None
    # Scope strictly to the caller; never reveal another user's passkey.
    if cred is None or cred.user_id != str(request.user.id):
        return Response({"error": "Passkey not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "DELETE":
        cred.delete()
        return Response({"message": "Passkey removed."})

    name = (request.data.get("name") or "").strip()
    if not name:
        return Response({"error": "A name is required."}, status=status.HTTP_400_BAD_REQUEST)
    cred.name = name[:PASSKEY_NAME_MAX_LENGTH]
    cred.save()
    return Response({"message": "Passkey renamed.", "passkey": _serialize(cred)})
