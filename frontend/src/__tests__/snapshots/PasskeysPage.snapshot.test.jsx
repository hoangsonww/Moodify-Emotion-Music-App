import React from "react";
import {
  render,
  screen,
  waitForElementToBeRemoved,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DarkModeContext } from "../../context/DarkModeContext";

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return { ...actual, useNavigate: () => jest.fn() };
});

jest.mock("../../components/Toast", () => ({
  useToast: () => ({
    show: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  }),
}));

// The page lists the user's passkeys on mount via the passkeys service. Mock it
// so there's no real network/WebAuthn dependency and the markup is stable.
jest.mock("../../services/passkeys", () => ({
  __esModule: true,
  listPasskeys: jest.fn().mockResolvedValue([]),
  isPasskeySupported: jest.fn().mockReturnValue(true),
  registerPasskey: jest.fn(),
  renamePasskey: jest.fn(),
  deletePasskey: jest.fn(),
  PasskeyError: class PasskeyError extends Error {},
}));

import PasskeysPage from "../../pages/PasskeysPage";

describe("PasskeysPage snapshot", () => {
  it("matches the rendered markup once the passkey list loads", async () => {
    const { asFragment } = render(
      <DarkModeContext.Provider value={{ isDarkMode: false }}>
        <MemoryRouter initialEntries={["/passkeys"]}>
          <PasskeysPage />
        </MemoryRouter>
      </DarkModeContext.Provider>,
    );

    // Loading spinner shows first; wait for it to clear so we snapshot the
    // settled (empty) list state.
    await waitForElementToBeRemoved(() => screen.queryByRole("progressbar"));

    expect(asFragment()).toMatchSnapshot();
  });
});
