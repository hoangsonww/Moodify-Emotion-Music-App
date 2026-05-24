import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import ResultsPage from "../pages/ResultsPage";
import { DarkModeContext } from "../context/DarkModeContext";
import axios from "axios";
import { MemoryRouter, Routes, Route } from "react-router-dom";

jest.mock("axios");

// HTMLMediaElement.prototype.play/pause aren't implemented in jsdom; the
// TrackPlayer component calls .pause() on cleanup. Stub them so the
// tests don't spam jsdom "not implemented" errors.
beforeAll(() => {
  Object.defineProperty(window.HTMLMediaElement.prototype, "play", {
    configurable: true,
    value: jest.fn().mockResolvedValue(undefined),
  });
  Object.defineProperty(window.HTMLMediaElement.prototype, "pause", {
    configurable: true,
    value: jest.fn(),
  });
});

describe("<ResultsPage />", () => {
  const initialState = {
    emotion: "happy",
    recommendations: [
      {
        name: "Song A",
        artist: "Artist A",
        image_url: "http://example.com/a.jpg",
        preview_url: "http://example.com/a.mp3",
        external_url: "http://spotify.com/a",
      },
      {
        name: "Song B",
        artist: "Artist B",
        image_url: "http://example.com/b.jpg",
        preview_url: null,
        external_url: "http://spotify.com/b",
      },
    ],
  };

  const setup = () => {
    render(
      <DarkModeContext.Provider value={{ isDarkMode: false }}>
        <MemoryRouter
          initialEntries={[{ pathname: "/results", state: initialState }]}
        >
          <Routes>
            <Route path="/results" element={<ResultsPage />} />
          </Routes>
        </MemoryRouter>
      </DarkModeContext.Provider>,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("renders detected mood title and initial recommendation cards", () => {
    setup();

    // Detected mood eyebrow + capitalized label.
    expect(screen.getByText(/DETECTED MOOD/i)).toBeInTheDocument();
    expect(screen.getByText(/^Happy$/)).toBeInTheDocument();

    // Recommendation cards (names + artists).
    expect(screen.getByText("Song A")).toBeInTheDocument();
    expect(screen.getByText("Artist A")).toBeInTheDocument();
    expect(screen.getByText("Song B")).toBeInTheDocument();
    expect(screen.getByText("Artist B")).toBeInTheDocument();

    // Open in Deezer buttons exist on every card.
    expect(screen.getAllByText(/Open in Deezer/i).length).toBeGreaterThan(0);
  });

  it("opens the mood Menu and refetches when a different mood is picked", async () => {
    const newRecs = [
      {
        name: "Song C",
        artist: "Artist C",
        image_url: "",
        preview_url: null,
        external_url: "",
      },
    ];
    axios.post.mockResolvedValueOnce({ data: { recommendations: newRecs } });

    setup();

    // Click the mood pill button - its label includes "Mood: Happy".
    fireEvent.click(screen.getByRole("button", { name: /Mood:\s*Happy/i }));

    // Pick "Joyful" (label for the joy emotion in MOOD_PALETTE).
    const joyOption = await screen.findByRole("menuitem", { name: /Joyful/i });
    fireEvent.click(joyOption);

    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining("/music_recommendation"),
        expect.objectContaining({
          emotion: "joy",
          history: [],
        }),
      ),
    );

    expect(await screen.findByText("Song C")).toBeInTheDocument();
    expect(screen.getByText("Artist C")).toBeInTheDocument();
  });

  it("opens the market Menu and refetches when a region is picked", async () => {
    const newRecs = [
      {
        name: "Song D",
        artist: "Artist D",
        image_url: "",
        preview_url: null,
        external_url: "",
      },
    ];
    axios.post.mockResolvedValueOnce({ data: { recommendations: newRecs } });

    setup();

    // The market pill defaults to "Global".
    fireEvent.click(screen.getByRole("button", { name: /^Global$/ }));

    const usOption = await screen.findByRole("menuitem", {
      name: /United States/i,
    });
    fireEvent.click(usOption);

    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining("/music_recommendation"),
        expect.objectContaining({
          emotion: "happy",
          market: "US",
          history: [],
        }),
      ),
    );

    expect(await screen.findByText("Song D")).toBeInTheDocument();
    expect(screen.getByText("Artist D")).toBeInTheDocument();
  });

  it("re-fetches a personalized list on mount when the user has mood history", async () => {
    window.localStorage.setItem("token", "token123");
    axios.get.mockResolvedValueOnce({
      data: { id: "u1", mood_history: ["sad", "calm", "sad"] },
    });
    axios.post.mockResolvedValueOnce({
      data: {
        recommendations: [
          {
            name: "Personalized Song",
            artist: "Artist P",
            image_url: "",
            preview_url: null,
            external_url: "",
          },
        ],
      },
    });

    setup();

    expect(await screen.findByText("Personalized Song")).toBeInTheDocument();
    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining("/music_recommendation"),
        expect.objectContaining({
          emotion: "happy",
          history: ["sad", "calm", "sad"],
        }),
      ),
    );
  });

  it("does not re-fetch on mount when the user is signed out", async () => {
    setup();
    expect(screen.getByText("Song A")).toBeInTheDocument();
    expect(axios.get).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });
});
