import React from "react";
import { render, screen } from "@testing-library/react";
import axios from "axios";
import { MemoryRouter } from "react-router-dom";
import { DarkModeContext } from "../../context/DarkModeContext";

jest.mock("axios");

// HomePage consumes the Toast context; provide a no-op stub.
jest.mock("../../components/Toast", () => ({
  useToast: () => ({
    show: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  }),
}));

import HomePage from "../../pages/HomePage";

// HomePage greets the user based on the current hour ("Good morning/..."), so
// freeze "now" to keep the snapshot stable across runs.
const RealDate = Date;
const FIXED_ISO = "2024-06-15T12:00:00.000Z";

beforeAll(() => {
  global.Date = class extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : [FIXED_ISO]));
    }
    static now() {
      return new RealDate(FIXED_ISO).getTime();
    }
  };
});

afterAll(() => {
  global.Date = RealDate;
});

describe("HomePage snapshot", () => {
  beforeEach(() => {
    window.localStorage.setItem("token", "fake-jwt-token");
    axios.get.mockResolvedValue({
      data: {
        id: "user-123",
        username: "Test User",
        mood_history: [],
        recommendations: [],
        listening_history: [],
      },
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
    window.localStorage.clear();
  });

  it("matches the rendered markup once the profile loads", async () => {
    const { asFragment } = render(
      <DarkModeContext.Provider value={{ isDarkMode: false }}>
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      </DarkModeContext.Provider>,
    );

    // Wait for the greeting to pick up the loaded username so the async state
    // has settled before we snapshot.
    await screen.findByText(/Test User/);

    expect(asFragment()).toMatchSnapshot();
  });
});
