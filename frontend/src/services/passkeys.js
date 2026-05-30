// WebAuthn / passkey client.
//
// Two responsibilities:
//   1. The raw browser ceremony -- turning the server's JSON options into the
//      ArrayBuffers `navigator.credentials.{create,get}` want, and turning the
//      resulting PublicKeyCredential back into JSON the backend can verify.
//      (Done by hand rather than pulling in @simplewebauthn/browser so the
//      committed package-lock.json stays untouched.)
//   2. Thin wrappers over the `/users/passkeys/*` endpoints.
//
// Every ceremony is two round-trips: `begin` (server issues options + an
// opaque flowId) then `complete` (we send the signed credential + flowId).

import axios from "axios";

import { API_URL } from "../config";

// --- base64url <-> ArrayBuffer -------------------------------------------
// Exported for unit testing; not part of the public surface otherwise.
export function base64urlToBuffer(base64url) {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (base64.length % 4)) % 4;
  const padded = base64 + "=".repeat(padLength);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export function bufferToBase64url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// --- capability detection -------------------------------------------------
export function isPasskeySupported() {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    !!navigator.credentials &&
    typeof navigator.credentials.create === "function" &&
    typeof navigator.credentials.get === "function"
  );
}

// True when the device has a built-in authenticator (Touch ID, Windows
// Hello, Android screen lock). Used to tailor copy ("this device") and to
// decide whether to surface the passkey prompt right after sign-up.
export async function isPlatformAuthenticatorAvailable() {
  if (!isPasskeySupported()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

// --- friendly errors ------------------------------------------------------
// navigator.credentials throws DOMExceptions whose names are the only stable
// signal. Map the ones users actually hit to readable messages; everything
// else falls through to a generic line.
export class PasskeyError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "PasskeyError";
    this.code = code || "unknown";
  }
}

function normalizeCeremonyError(error) {
  const name = error && error.name;
  if (name === "NotAllowedError") {
    return new PasskeyError(
      "Passkey prompt was dismissed or timed out. Please try again.",
      "cancelled",
    );
  }
  if (name === "InvalidStateError") {
    return new PasskeyError(
      "This device already has a passkey for your account.",
      "already_registered",
    );
  }
  if (name === "SecurityError") {
    return new PasskeyError(
      "Passkeys can't be used on this page's domain. Please contact support.",
      "security",
    );
  }
  if (name === "AbortError") {
    return new PasskeyError("Passkey request was cancelled.", "cancelled");
  }
  return new PasskeyError(
    (error && error.message) || "Something went wrong with the passkey.",
    "unknown",
  );
}

// --- raw ceremony ---------------------------------------------------------
async function runRegistrationCeremony(options) {
  const publicKey = {
    ...options,
    challenge: base64urlToBuffer(options.challenge),
    user: { ...options.user, id: base64urlToBuffer(options.user.id) },
    excludeCredentials: (options.excludeCredentials || []).map((cred) => ({
      ...cred,
      id: base64urlToBuffer(cred.id),
    })),
  };

  let credential;
  try {
    credential = await navigator.credentials.create({ publicKey });
  } catch (error) {
    throw normalizeCeremonyError(error);
  }
  if (!credential) {
    throw new PasskeyError("No passkey was created.", "no_credential");
  }

  const response = credential.response;
  const transports =
    typeof response.getTransports === "function"
      ? response.getTransports()
      : [];

  return {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment || undefined,
    response: {
      clientDataJSON: bufferToBase64url(response.clientDataJSON),
      attestationObject: bufferToBase64url(response.attestationObject),
      transports: transports || [],
    },
    clientExtensionResults: credential.getClientExtensionResults
      ? credential.getClientExtensionResults()
      : {},
  };
}

async function runAuthenticationCeremony(options) {
  const publicKey = {
    ...options,
    challenge: base64urlToBuffer(options.challenge),
    allowCredentials: (options.allowCredentials || []).map((cred) => ({
      ...cred,
      id: base64urlToBuffer(cred.id),
    })),
  };

  let credential;
  try {
    credential = await navigator.credentials.get({ publicKey });
  } catch (error) {
    throw normalizeCeremonyError(error);
  }
  if (!credential) {
    throw new PasskeyError("No passkey was selected.", "no_credential");
  }

  const response = credential.response;
  return {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment || undefined,
    response: {
      clientDataJSON: bufferToBase64url(response.clientDataJSON),
      authenticatorData: bufferToBase64url(response.authenticatorData),
      signature: bufferToBase64url(response.signature),
      userHandle: response.userHandle
        ? bufferToBase64url(response.userHandle)
        : null,
    },
    clientExtensionResults: credential.getClientExtensionResults
      ? credential.getClientExtensionResults()
      : {},
  };
}

// --- high-level flows -----------------------------------------------------

// Enroll a new passkey for the signed-in user.
//
// `accessToken` is for the just-signed-up flow, where tokens are held in
// component state and not yet persisted to localStorage -- so the global
// axios interceptor (which reads localStorage) can't attach them. When the
// management page calls this, the user is already persisted and the
// interceptor handles auth, so no token is passed.
export async function registerPasskey({ name, accessToken } = {}) {
  if (!isPasskeySupported()) {
    throw new PasskeyError(
      "This browser doesn't support passkeys.",
      "unsupported",
    );
  }
  const authConfig = accessToken
    ? { headers: { Authorization: `Bearer ${accessToken}` } }
    : {};

  const begin = await axios.post(
    `${API_URL}/users/passkeys/register/begin/`,
    {},
    authConfig,
  );
  const { options, flowId } = begin.data;

  const credential = await runRegistrationCeremony(options);

  const complete = await axios.post(
    `${API_URL}/users/passkeys/register/complete/`,
    { flowId, credential, name },
    authConfig,
  );
  return complete.data.passkey;
}

// Sign in with a passkey. `username` is optional: omit it for a usernameless
// (discoverable-credential) prompt. Returns the { access, refresh } pair.
export async function loginWithPasskey({ username } = {}) {
  if (!isPasskeySupported()) {
    throw new PasskeyError(
      "This browser doesn't support passkeys.",
      "unsupported",
    );
  }
  const begin = await axios.post(
    `${API_URL}/users/passkeys/login/begin/`,
    username ? { username } : {},
    { _skipAuthRefresh: true },
  );
  const { options, flowId } = begin.data;

  const credential = await runAuthenticationCeremony(options);

  const complete = await axios.post(
    `${API_URL}/users/passkeys/login/complete/`,
    { flowId, credential },
    { _skipAuthRefresh: true },
  );
  return complete.data; // { access, refresh, username }
}

// --- management -----------------------------------------------------------
export async function listPasskeys() {
  const res = await axios.get(`${API_URL}/users/passkeys/`);
  return res.data.passkeys || [];
}

export async function renamePasskey(id, name) {
  const res = await axios.patch(`${API_URL}/users/passkeys/${id}/`, { name });
  return res.data.passkey;
}

export async function deletePasskey(id) {
  await axios.delete(`${API_URL}/users/passkeys/${id}/`);
}
