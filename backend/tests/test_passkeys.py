"""Tests for the WebAuthn / passkey endpoints (users app).

The cryptographic verification done by ``py_webauthn`` is exercised by that
library's own suite; here we mock the two ``verify_*`` calls at the view
boundary and test everything *we* own for real: challenge issue/consume
(single-use + expiry), credential persistence, sign-counter advancement,
ownership scoping on manage routes, token issuance on login, and the error
paths. Option generation (begin) is exercised end-to-end against the real
library.
"""

from datetime import datetime, timedelta
from types import SimpleNamespace

from webauthn.helpers import bytes_to_base64url

from users.documents import WebAuthnChallenge, WebAuthnCredential


# --------------------------------------------------------------------------
# Fixtures / helpers
# --------------------------------------------------------------------------
def _fake_registration(credential_id=b"cred-id-1", public_key=b"pub-key-1",
                       sign_count=0, device_type="multi_device", backed_up=True):
    """Stand-in for py_webauthn's VerifiedRegistration (attrs only)."""
    return SimpleNamespace(
        credential_id=credential_id,
        credential_public_key=public_key,
        sign_count=sign_count,
        aaguid="00000000-0000-0000-0000-000000000000",
        credential_device_type=device_type,
        credential_backed_up=backed_up,
    )


def _fake_authentication(new_sign_count=5, device_type="multi_device", backed_up=True):
    """Stand-in for py_webauthn's VerifiedAuthentication (attrs only)."""
    return SimpleNamespace(
        new_sign_count=new_sign_count,
        credential_device_type=device_type,
        credential_backed_up=backed_up,
        user_verified=True,
    )


def _make_credential(user, credential_id="stored-cred-1", sign_count=0, name="Phone"):
    return WebAuthnCredential(
        user_id=str(user.id),
        username=user.username,
        credential_id=credential_id,
        public_key="cHVi",  # base64url("pub")
        sign_count=sign_count,
        name=name,
    ).save()


def _reg_credential():
    """A registration-shaped credential blob the client would POST."""
    return {
        "id": "abc",
        "rawId": "abc",
        "type": "public-key",
        "response": {
            "clientDataJSON": "x",
            "attestationObject": "y",
            "transports": ["internal", "hybrid"],
        },
    }


def _auth_credential(credential_id):
    """An assertion-shaped credential blob the client would POST."""
    return {
        "id": credential_id,
        "rawId": credential_id,
        "type": "public-key",
        "response": {
            "clientDataJSON": "x",
            "authenticatorData": "y",
            "signature": "z",
            "userHandle": None,
        },
    }


# --------------------------------------------------------------------------
# Registration ceremony
# --------------------------------------------------------------------------
class TestRegisterBegin:
    def test_requires_auth(self, api_client):
        resp = api_client.post("/users/passkeys/register/begin/", {}, format="json")
        assert resp.status_code in (401, 403)

    def test_returns_options_and_stores_challenge(self, auth_client):
        resp = auth_client.post("/users/passkeys/register/begin/", {}, format="json")
        assert resp.status_code == 200
        assert "flowId" in resp.data
        options = resp.data["options"]
        assert "challenge" in options
        assert options["rp"]["id"] == "localhost"
        assert options["user"]["name"] == auth_client.user.username
        # The challenge row was persisted, tied to this user, for registration.
        stored = WebAuthnChallenge.objects(id=resp.data["flowId"]).first()
        assert stored is not None
        assert stored.purpose == "registration"
        assert stored.user_id == str(auth_client.user.id)

    def test_excludes_existing_credentials(self, auth_client):
        # Real credential ids are always canonical base64url, so they survive
        # the decode -> descriptor -> re-encode round-trip unchanged.
        cid = bytes_to_base64url(b"already-there")
        _make_credential(auth_client.user, credential_id=cid)
        resp = auth_client.post("/users/passkeys/register/begin/", {}, format="json")
        ids = [c["id"] for c in resp.data["options"].get("excludeCredentials", [])]
        assert cid in ids


class TestRegisterComplete:
    def _begin(self, auth_client):
        return auth_client.post("/users/passkeys/register/begin/", {}, format="json").data["flowId"]

    def test_happy_path_creates_credential(self, auth_client, monkeypatch):
        monkeypatch.setattr("users.passkey_views.verify_registration_response",
                            lambda **kw: _fake_registration())
        flow_id = self._begin(auth_client)
        resp = auth_client.post(
            "/users/passkeys/register/complete/",
            {"flowId": flow_id, "credential": _reg_credential(), "name": "My Laptop"},
            format="json",
        )
        assert resp.status_code == 201
        cred = WebAuthnCredential.objects(user_id=str(auth_client.user.id)).first()
        assert cred is not None
        assert cred.name == "My Laptop"
        assert cred.credential_id == bytes_to_base64url(b"cred-id-1")
        assert cred.transports == ["internal", "hybrid"]
        assert cred.backed_up is True
        # The challenge was consumed (single use).
        assert WebAuthnChallenge.objects(id=flow_id).first() is None

    def test_default_name_when_omitted(self, auth_client, monkeypatch):
        monkeypatch.setattr("users.passkey_views.verify_registration_response",
                            lambda **kw: _fake_registration())
        flow_id = self._begin(auth_client)
        resp = auth_client.post(
            "/users/passkeys/register/complete/",
            {"flowId": flow_id, "credential": _reg_credential()},
            format="json",
        )
        assert resp.status_code == 201
        assert resp.data["passkey"]["name"] == "Passkey"

    def test_unknown_flow_rejected(self, auth_client, monkeypatch):
        monkeypatch.setattr("users.passkey_views.verify_registration_response",
                            lambda **kw: _fake_registration())
        resp = auth_client.post(
            "/users/passkeys/register/complete/",
            {"flowId": "64f0000000000000000000aa", "credential": _reg_credential()},
            format="json",
        )
        assert resp.status_code == 400

    def test_expired_flow_rejected(self, auth_client, monkeypatch):
        monkeypatch.setattr("users.passkey_views.verify_registration_response",
                            lambda **kw: _fake_registration())
        expired = WebAuthnChallenge(
            challenge="abc", purpose="registration", user_id=str(auth_client.user.id),
            expires_at=datetime.utcnow() - timedelta(seconds=1),
        ).save()
        resp = auth_client.post(
            "/users/passkeys/register/complete/",
            {"flowId": str(expired.id), "credential": _reg_credential()},
            format="json",
        )
        assert resp.status_code == 400

    def test_other_users_flow_rejected(self, auth_client, make_user, monkeypatch):
        monkeypatch.setattr("users.passkey_views.verify_registration_response",
                            lambda **kw: _fake_registration())
        other = make_user(username="mallory", email="m@example.com")
        foreign = WebAuthnChallenge(
            challenge="abc", purpose="registration", user_id=str(other.id),
            expires_at=datetime.utcnow() + timedelta(minutes=5),
        ).save()
        resp = auth_client.post(
            "/users/passkeys/register/complete/",
            {"flowId": str(foreign.id), "credential": _reg_credential()},
            format="json",
        )
        assert resp.status_code == 400

    def test_duplicate_credential_conflict(self, auth_client, monkeypatch):
        monkeypatch.setattr("users.passkey_views.verify_registration_response",
                            lambda **kw: _fake_registration())
        _make_credential(auth_client.user, credential_id=bytes_to_base64url(b"cred-id-1"))
        flow_id = self._begin(auth_client)
        resp = auth_client.post(
            "/users/passkeys/register/complete/",
            {"flowId": flow_id, "credential": _reg_credential()},
            format="json",
        )
        assert resp.status_code == 409

    def test_verification_failure_is_400(self, auth_client, monkeypatch):
        def _boom(**kw):
            raise ValueError("bad attestation")
        monkeypatch.setattr("users.passkey_views.verify_registration_response", _boom)
        flow_id = self._begin(auth_client)
        resp = auth_client.post(
            "/users/passkeys/register/complete/",
            {"flowId": flow_id, "credential": _reg_credential()},
            format="json",
        )
        assert resp.status_code == 400

    def test_can_register_multiple_passkeys(self, auth_client, monkeypatch):
        for i in range(3):
            monkeypatch.setattr(
                "users.passkey_views.verify_registration_response",
                lambda _i=i, **kw: _fake_registration(credential_id=f"cred-{_i}".encode()),
            )
            flow_id = self._begin(auth_client)
            resp = auth_client.post(
                "/users/passkeys/register/complete/",
                {"flowId": flow_id, "credential": _reg_credential(), "name": f"Key {i}"},
                format="json",
            )
            assert resp.status_code == 201
        assert WebAuthnCredential.objects(user_id=str(auth_client.user.id)).count() == 3


# --------------------------------------------------------------------------
# Authentication ceremony
# --------------------------------------------------------------------------
class TestLoginBegin:
    def test_usernameless_returns_options(self, api_client):
        resp = api_client.post("/users/passkeys/login/begin/", {}, format="json")
        assert resp.status_code == 200
        assert "challenge" in resp.data["options"]
        assert WebAuthnChallenge.objects(id=resp.data["flowId"]).first().purpose == "authentication"

    def test_username_scopes_allow_credentials(self, api_client, make_user):
        user = make_user(username="scoped", email="s@example.com")
        cid = bytes_to_base64url(b"scoped-cred")
        _make_credential(user, credential_id=cid)
        resp = api_client.post("/users/passkeys/login/begin/", {"username": "scoped"}, format="json")
        ids = [c["id"] for c in resp.data["options"].get("allowCredentials", [])]
        assert cid in ids
        assert WebAuthnChallenge.objects(id=resp.data["flowId"]).first().user_id == str(user.id)

    def test_unknown_username_does_not_disclose(self, api_client):
        # Still a 200 with a well-formed challenge -- no account-existence leak.
        resp = api_client.post("/users/passkeys/login/begin/", {"username": "ghost"}, format="json")
        assert resp.status_code == 200
        assert resp.data["options"].get("allowCredentials", []) == []


class TestLoginComplete:
    def _begin(self, api_client, username=None):
        body = {"username": username} if username else {}
        return api_client.post("/users/passkeys/login/begin/", body, format="json").data["flowId"]

    def test_happy_path_issues_tokens(self, api_client, make_user, monkeypatch):
        user = make_user(username="passkeyuser", email="p@example.com")
        cred = _make_credential(user, credential_id="login-cred", sign_count=0)
        monkeypatch.setattr("users.passkey_views.verify_authentication_response",
                            lambda **kw: _fake_authentication(new_sign_count=7))
        flow_id = self._begin(api_client)
        resp = api_client.post(
            "/users/passkeys/login/complete/",
            {"flowId": flow_id, "credential": _auth_credential("login-cred")},
            format="json",
        )
        assert resp.status_code == 200
        assert "access" in resp.data and "refresh" in resp.data
        assert resp.data["username"] == "passkeyuser"
        # Sign counter advanced + last_used stamped.
        cred.reload()
        assert cred.sign_count == 7
        assert cred.last_used_at is not None
        assert WebAuthnChallenge.objects(id=flow_id).first() is None

    def test_issued_token_authenticates(self, api_client, make_user, monkeypatch):
        user = make_user(username="tokentest", email="t@example.com")
        _make_credential(user, credential_id="tok-cred")
        monkeypatch.setattr("users.passkey_views.verify_authentication_response",
                            lambda **kw: _fake_authentication())
        flow_id = self._begin(api_client)
        resp = api_client.post(
            "/users/passkeys/login/complete/",
            {"flowId": flow_id, "credential": _auth_credential("tok-cred")},
            format="json",
        )
        token = resp.data["access"]
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        me = api_client.get("/users/validate_token/")
        assert me.status_code == 200
        assert me.data["username"] == "tokentest"

    def test_unknown_credential_rejected(self, api_client, monkeypatch):
        monkeypatch.setattr("users.passkey_views.verify_authentication_response",
                            lambda **kw: _fake_authentication())
        flow_id = self._begin(api_client)
        resp = api_client.post(
            "/users/passkeys/login/complete/",
            {"flowId": flow_id, "credential": _auth_credential("does-not-exist")},
            format="json",
        )
        assert resp.status_code == 401

    def test_expired_flow_rejected(self, api_client, make_user, monkeypatch):
        user = make_user(username="exp", email="e@example.com")
        _make_credential(user, credential_id="exp-cred")
        monkeypatch.setattr("users.passkey_views.verify_authentication_response",
                            lambda **kw: _fake_authentication())
        expired = WebAuthnChallenge(
            challenge="abc", purpose="authentication",
            expires_at=datetime.utcnow() - timedelta(seconds=1),
        ).save()
        resp = api_client.post(
            "/users/passkeys/login/complete/",
            {"flowId": str(expired.id), "credential": _auth_credential("exp-cred")},
            format="json",
        )
        assert resp.status_code == 400

    def test_credential_must_match_scoped_user(self, api_client, make_user, monkeypatch):
        owner = make_user(username="owner", email="o@example.com")
        intruder = make_user(username="intruder", email="i@example.com")
        _make_credential(intruder, credential_id="intruder-cred")
        monkeypatch.setattr("users.passkey_views.verify_authentication_response",
                            lambda **kw: _fake_authentication())
        # Ceremony scoped to `owner`, but the assertion presents intruder's key.
        flow_id = self._begin(api_client, username="owner")
        resp = api_client.post(
            "/users/passkeys/login/complete/",
            {"flowId": flow_id, "credential": _auth_credential("intruder-cred")},
            format="json",
        )
        assert resp.status_code == 401
        assert owner  # owner exists; used only to scope the ceremony

    def test_verification_failure_is_401(self, api_client, make_user, monkeypatch):
        user = make_user(username="vf", email="vf@example.com")
        _make_credential(user, credential_id="vf-cred")

        def _boom(**kw):
            raise ValueError("bad signature")
        monkeypatch.setattr("users.passkey_views.verify_authentication_response", _boom)
        flow_id = self._begin(api_client)
        resp = api_client.post(
            "/users/passkeys/login/complete/",
            {"flowId": flow_id, "credential": _auth_credential("vf-cred")},
            format="json",
        )
        assert resp.status_code == 401


# --------------------------------------------------------------------------
# Management (list / rename / delete)
# --------------------------------------------------------------------------
class TestManage:
    def test_list_requires_auth(self, api_client):
        resp = api_client.get("/users/passkeys/")
        assert resp.status_code in (401, 403)

    def test_list_only_returns_own(self, auth_client, make_user):
        _make_credential(auth_client.user, credential_id="mine-1", name="Mine")
        other = make_user(username="someoneelse", email="se@example.com")
        _make_credential(other, credential_id="theirs-1", name="Theirs")
        resp = auth_client.get("/users/passkeys/")
        assert resp.status_code == 200
        names = [p["name"] for p in resp.data["passkeys"]]
        assert names == ["Mine"]
        # No secret material leaks.
        assert "public_key" not in resp.data["passkeys"][0]

    def test_rename(self, auth_client):
        cred = _make_credential(auth_client.user, credential_id="rn-1", name="Old")
        resp = auth_client.patch(f"/users/passkeys/{cred.id}/", {"name": "New name"}, format="json")
        assert resp.status_code == 200
        cred.reload()
        assert cred.name == "New name"

    def test_rename_empty_rejected(self, auth_client):
        cred = _make_credential(auth_client.user, credential_id="rn-2")
        resp = auth_client.patch(f"/users/passkeys/{cred.id}/", {"name": "   "}, format="json")
        assert resp.status_code == 400

    def test_rename_truncated_to_max_length(self, auth_client):
        cred = _make_credential(auth_client.user, credential_id="rn-3")
        resp = auth_client.patch(f"/users/passkeys/{cred.id}/", {"name": "z" * 200}, format="json")
        assert resp.status_code == 200
        cred.reload()
        assert len(cred.name) == 60

    def test_cannot_rename_others(self, auth_client, make_user):
        other = make_user(username="victim", email="v@example.com")
        cred = _make_credential(other, credential_id="victim-1", name="Victim")
        resp = auth_client.patch(f"/users/passkeys/{cred.id}/", {"name": "hacked"}, format="json")
        assert resp.status_code == 404
        cred.reload()
        assert cred.name == "Victim"

    def test_delete(self, auth_client):
        cred = _make_credential(auth_client.user, credential_id="del-1")
        resp = auth_client.delete(f"/users/passkeys/{cred.id}/")
        assert resp.status_code == 200
        assert WebAuthnCredential.objects(id=cred.id).first() is None

    def test_cannot_delete_others(self, auth_client, make_user):
        other = make_user(username="victim2", email="v2@example.com")
        cred = _make_credential(other, credential_id="victim-2")
        resp = auth_client.delete(f"/users/passkeys/{cred.id}/")
        assert resp.status_code == 404
        assert WebAuthnCredential.objects(id=cred.id).first() is not None

    def test_bad_id_is_404(self, auth_client):
        resp = auth_client.delete("/users/passkeys/not-an-objectid/")
        assert resp.status_code == 404
