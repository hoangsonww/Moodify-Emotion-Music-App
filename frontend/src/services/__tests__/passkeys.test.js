import axios from "axios";

import {
  base64urlToBuffer,
  bufferToBase64url,
  isPasskeySupported,
  loginWithPasskey,
  registerPasskey,
  listPasskeys,
  renamePasskey,
  deletePasskey,
} from "../passkeys";

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

// jsdom has no WebAuthn; install fakes per test and tear them down after.
function installWebAuthn({ create, get } = {}) {
  global.PublicKeyCredential = function PublicKeyCredential() {};
  Object.defineProperty(global.navigator, "credentials", {
    value: { create: create || jest.fn(), get: get || jest.fn() },
    configurable: true,
    writable: true,
  });
}

function removeWebAuthn() {
  delete global.PublicKeyCredential;
  Object.defineProperty(global.navigator, "credentials", {
    value: undefined,
    configurable: true,
    writable: true,
  });
}

// A fake PublicKeyCredential as navigator.credentials.{create,get} would
// return: binary members are Uint8Arrays (bufferToBase64url handles those).
function fakeRegistrationCredential() {
  return {
    id: "abc",
    rawId: new Uint8Array([1, 2, 3]),
    type: "public-key",
    authenticatorAttachment: "platform",
    response: {
      clientDataJSON: new Uint8Array([4, 5, 6]),
      attestationObject: new Uint8Array([7, 8, 9]),
      getTransports: () => ["internal", "hybrid"],
    },
    getClientExtensionResults: () => ({}),
  };
}

function fakeAuthenticationCredential() {
  return {
    id: "abc",
    rawId: new Uint8Array([1, 2, 3]),
    type: "public-key",
    authenticatorAttachment: "platform",
    response: {
      clientDataJSON: new Uint8Array([4, 5, 6]),
      authenticatorData: new Uint8Array([7, 8, 9]),
      signature: new Uint8Array([10, 11, 12]),
      userHandle: new Uint8Array([13, 14]),
    },
    getClientExtensionResults: () => ({}),
  };
}

afterEach(() => {
  jest.clearAllMocks();
  removeWebAuthn();
});

describe("base64url helpers", () => {
  it("round-trips arbitrary bytes", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    const encoded = bufferToBase64url(bytes.buffer);
    expect(encoded).not.toMatch(/[+/=]/); // url-safe, unpadded
    expect(new Uint8Array(base64urlToBuffer(encoded))).toEqual(bytes);
  });

  it("encodes known vectors", () => {
    expect(bufferToBase64url(new Uint8Array([1, 2, 3]).buffer)).toBe("AQID");
  });
});

describe("isPasskeySupported", () => {
  it("is false without navigator.credentials", () => {
    removeWebAuthn();
    expect(isPasskeySupported()).toBe(false);
  });

  it("is true when the WebAuthn API is present", () => {
    installWebAuthn();
    expect(isPasskeySupported()).toBe(true);
  });
});

describe("registerPasskey", () => {
  it("wires begin -> ceremony -> complete and base64url-encodes the result", async () => {
    const create = jest.fn().mockResolvedValue(fakeRegistrationCredential());
    installWebAuthn({ create });
    axios.post
      .mockResolvedValueOnce({
        data: {
          flowId: "flow-1",
          options: {
            rp: { id: "localhost", name: "Moodify" },
            user: { id: "AQID", name: "alice", displayName: "alice" },
            challenge: "AQID",
            pubKeyCredParams: [{ alg: -7, type: "public-key" }],
            excludeCredentials: [],
          },
        },
      })
      .mockResolvedValueOnce({ data: { passkey: { id: "pk1", name: "Laptop" } } });

    const passkey = await registerPasskey({ name: "Laptop", accessToken: "tok" });

    expect(passkey).toEqual({ id: "pk1", name: "Laptop" });
    expect(create).toHaveBeenCalledTimes(1);

    // begin: authed with the explicit token (post-sign-up flow).
    expect(axios.post).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/users/passkeys/register/begin/"),
      {},
      expect.objectContaining({ headers: { Authorization: "Bearer tok" } }),
    );
    // complete: flowId echoed + credential serialised to base64url JSON.
    const [, completeBody] = axios.post.mock.calls[1];
    expect(completeBody.flowId).toBe("flow-1");
    expect(completeBody.name).toBe("Laptop");
    expect(completeBody.credential.rawId).toBe("AQID");
    expect(completeBody.credential.response.clientDataJSON).toBe(
      bufferToBase64url(new Uint8Array([4, 5, 6]).buffer),
    );
    expect(completeBody.credential.response.attestationObject).toBe(
      bufferToBase64url(new Uint8Array([7, 8, 9]).buffer),
    );
    expect(completeBody.credential.response.transports).toEqual([
      "internal",
      "hybrid",
    ]);
  });

  it("throws a friendly PasskeyError when the prompt is dismissed", async () => {
    const create = jest
      .fn()
      .mockRejectedValue(
        Object.assign(new Error("denied"), { name: "NotAllowedError" }),
      );
    installWebAuthn({ create });
    axios.post.mockResolvedValueOnce({
      data: { flowId: "f", options: { user: { id: "AQID" }, challenge: "AQID" } },
    });

    await expect(registerPasskey({})).rejects.toMatchObject({
      name: "PasskeyError",
      code: "cancelled",
    });
    // The ceremony failed, so complete is never called.
    expect(axios.post).toHaveBeenCalledTimes(1);
  });
});

describe("loginWithPasskey", () => {
  it("wires begin -> ceremony -> complete and returns the token pair", async () => {
    const get = jest.fn().mockResolvedValue(fakeAuthenticationCredential());
    installWebAuthn({ get });
    axios.post
      .mockResolvedValueOnce({
        data: {
          flowId: "flow-2",
          options: { challenge: "AQID", allowCredentials: [], rpId: "localhost" },
        },
      })
      .mockResolvedValueOnce({
        data: { access: "a", refresh: "r", username: "alice" },
      });

    const tokens = await loginWithPasskey({ username: "alice" });

    expect(tokens).toEqual({ access: "a", refresh: "r", username: "alice" });
    expect(get).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/users/passkeys/login/begin/"),
      { username: "alice" },
      expect.objectContaining({ _skipAuthRefresh: true }),
    );
    const [, completeBody] = axios.post.mock.calls[1];
    expect(completeBody.flowId).toBe("flow-2");
    expect(completeBody.credential.response.userHandle).toBe(
      bufferToBase64url(new Uint8Array([13, 14]).buffer),
    );
    expect(completeBody.credential.response.signature).toBe(
      bufferToBase64url(new Uint8Array([10, 11, 12]).buffer),
    );
  });

  it("omits the username for a usernameless prompt", async () => {
    const get = jest.fn().mockResolvedValue(fakeAuthenticationCredential());
    installWebAuthn({ get });
    axios.post
      .mockResolvedValueOnce({
        data: { flowId: "f", options: { challenge: "AQID", allowCredentials: [] } },
      })
      .mockResolvedValueOnce({ data: { access: "a", refresh: "r" } });

    await loginWithPasskey({});
    expect(axios.post).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      {},
      expect.objectContaining({ _skipAuthRefresh: true }),
    );
  });
});

describe("management calls", () => {
  it("listPasskeys returns the array", async () => {
    axios.get.mockResolvedValueOnce({ data: { passkeys: [{ id: "1" }] } });
    expect(await listPasskeys()).toEqual([{ id: "1" }]);
  });

  it("renamePasskey PATCHes the new name", async () => {
    axios.patch.mockResolvedValueOnce({ data: { passkey: { id: "1", name: "X" } } });
    const out = await renamePasskey("1", "X");
    expect(out).toEqual({ id: "1", name: "X" });
    expect(axios.patch).toHaveBeenCalledWith(
      expect.stringContaining("/users/passkeys/1/"),
      { name: "X" },
    );
  });

  it("deletePasskey DELETEs the id", async () => {
    axios.delete.mockResolvedValueOnce({});
    await deletePasskey("1");
    expect(axios.delete).toHaveBeenCalledWith(
      expect.stringContaining("/users/passkeys/1/"),
    );
  });
});
