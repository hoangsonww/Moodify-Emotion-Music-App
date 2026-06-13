import React from "react";
import { render, screen } from "@testing-library/react";
import axios from "axios";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { DarkModeContext } from "../../context/DarkModeContext";
import ProfilePage from "../../pages/ProfilePage";

jest.mock("axios");

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return { ...actual, useNavigate: () => jest.fn() };
});

// Profile fetch errors are logged on the unhappy path; keep the happy path quiet.
beforeAll(() => jest.spyOn(console, "error").mockImplementation(() => {}));
afterAll(() => console.error.mockRestore());

describe("ProfilePage snapshot", () => {
  const fakeUser = {
    username: "testuser",
    email: "test@example.com",
    mood_history: ["Happy", "Sad"],
    recommendations: [
      {
        name: "Song X",
        artist: "Artist X",
        image_url: "img.jpg",
        preview_url: "preview.mp3",
        external_url: "https://spotify.com/x",
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.setItem("token", "token123");
    window.localStorage.removeItem("userProfileCache");
  });

  afterEach(() => window.localStorage.clear());

  it("matches the rendered markup once the profile loads", async () => {
    axios.get.mockResolvedValueOnce({ data: fakeUser });

    const { asFragment } = render(
      <DarkModeContext.Provider value={{ isDarkMode: false }}>
        <MemoryRouter initialEntries={["/profile"]}>
          <Routes>
            <Route path="/profile" element={<ProfilePage />} />
          </Routes>
        </MemoryRouter>
      </DarkModeContext.Provider>,
    );

    // Wait for the loaded state so we snapshot the populated profile, not the
    // transient "Loading..." view.
    await screen.findByText(/Welcome, testuser!/i);

    expect(asFragment()).toMatchSnapshot();
  });
});
