import React from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DarkModeContext } from "../../context/DarkModeContext";

jest.mock("axios");

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

import ForgotPassword from "../../pages/ForgotPassword";

// The first field uses autoFocus, which toggles MUI's focus classes. jsdom
// honors autoFocus inconsistently across environments (it focuses locally but
// not in CI), so neutralize focus to keep the snapshot stable everywhere.
beforeAll(() => {
  jest.spyOn(HTMLElement.prototype, "focus").mockImplementation(() => {});
});
afterAll(() => {
  HTMLElement.prototype.focus.mockRestore();
});

describe("ForgotPassword snapshot", () => {
  it("matches the rendered markup", () => {
    const { asFragment } = render(
      <DarkModeContext.Provider value={{ isDarkMode: false }}>
        <MemoryRouter initialEntries={["/forgot-password"]}>
          <ForgotPassword />
        </MemoryRouter>
      </DarkModeContext.Provider>,
    );

    expect(asFragment()).toMatchSnapshot();
  });
});
