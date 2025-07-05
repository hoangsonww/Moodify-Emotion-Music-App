import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import axios from "axios";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { DarkModeContext } from "../context/DarkModeContext";
import ProfilePage from "../pages/ProfilePage";

// -- Mocks --
jest.mock("axios");

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => {
  const original = jest.requireActual("react-router-dom");
  return {
    ...original,
    useNavigate: () => mockNavigate,
  };
});

// Silence expected console.error in tests
beforeAll(() => jest.spyOn(console, "error").mockImplementation(() => {}));
afterAll(() => console.error.mockRestore());

describe("<ProfilePage />", () => {
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
    localStorage.removeItem("userProfileCache");
  });
  afterEach(() => window.localStorage.clear());

  it("shows loading then renders profile info, mood and rec history", async () => {
    axios.get.mockResolvedValueOnce({ data: fakeUser });

    render(
      <DarkModeContext.Provider value={{ isDarkMode: false }}>
        <MemoryRouter initialEntries={["/profile"]}>
          <Routes>
            <Route path="/profile" element={<ProfilePage />} />
          </Routes>
        </MemoryRouter>
      </DarkModeContext.Provider>,
    );

    // Loading indicator
    expect(screen.getByText(/Loading\.\.\./i)).toBeInTheDocument();

    // Wait for data load
    expect(await screen.findByText(/Welcome, testuser!/i)).toBeInTheDocument();

    // Profile fields
    expect(screen.getByText(/Your Username: testuser/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Your Email: test@example\.com/i),
    ).toBeInTheDocument();

    // Mood history
    expect(screen.getByText("Happy")).toBeInTheDocument();
    expect(screen.getByText("Sad")).toBeInTheDocument();

    // Recommendations history
    expect(screen.getByText("Song X")).toBeInTheDocument();
    expect(screen.getByText("Artist X")).toBeInTheDocument();

    // Spotify link via text
    const link = screen.getByText(/Listen on Spotify/i).closest("a");
    expect(link).toHaveAttribute("href", "https://spotify.com/x");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("clicking a mood card fetches recommendations and navigates", async () => {
    axios.get.mockResolvedValueOnce({ data: fakeUser });
    const recData = { emotion: "sad", recommendations: [] };
    axios.post.mockResolvedValueOnce({ data: recData });

    render(
      <DarkModeContext.Provider value={{ isDarkMode: false }}>
        <MemoryRouter initialEntries={["/profile"]}>
          <Routes>
            <Route path="/profile" element={<ProfilePage />} />
          </Routes>
        </MemoryRouter>
      </DarkModeContext.Provider>,
    );

    await screen.findByText(/Welcome, testuser!/i);

    fireEvent.click(screen.getByText("Happy"));

    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining("/api/music_recommendation/"),
        { emotion: "happy" },
        expect.any(Object),
      ),
    );
    expect(mockNavigate).toHaveBeenCalledWith("/results", {
      state: recData,
    });
  });

  it("shows error message if fetch fails and no cache", async () => {
    axios.get.mockRejectedValueOnce(new Error("Network error"));

    render(
      <DarkModeContext.Provider value={{ isDarkMode: false }}>
        <MemoryRouter initialEntries={["/profile"]}>
          <Routes>
            <Route path="/profile" element={<ProfilePage />} />
          </Routes>
        </MemoryRouter>
      </DarkModeContext.Provider>,
    );

    expect(
      await screen.findByText(/Failed to fetch profile data/i),
    ).toBeInTheDocument();
  });
});
