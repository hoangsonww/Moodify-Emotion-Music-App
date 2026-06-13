import React from "react";
import { render } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { DarkModeContext } from "../../context/DarkModeContext";
import ResultsPage from "../../pages/ResultsPage";

// jsdom doesn't implement media playback; TrackPlayer calls play/pause.
beforeAll(() => {
  Object.defineProperty(window.HTMLMediaElement.prototype, "play", {
    configurable: true,
    value: jest.fn().mockResolvedValue(undefined),
  });
  Object.defineProperty(window.HTMLMediaElement.prototype, "pause", {
    configurable: true,
    value: jest.fn(),
  });
  // ResultsPage shuffles recommendations with Math.random; pin it so the
  // rendered order (and therefore the snapshot) is deterministic.
  jest.spyOn(global.Math, "random").mockReturnValue(0);
});

afterAll(() => {
  global.Math.random.mockRestore();
});

describe("ResultsPage snapshot", () => {
  const state = {
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

  it("matches the rendered markup", () => {
    // Signed out (no token) so the page renders the passed-in state without
    // firing a personalized refetch on mount.
    const { asFragment } = render(
      <DarkModeContext.Provider value={{ isDarkMode: false }}>
        <MemoryRouter initialEntries={[{ pathname: "/results", state }]}>
          <Routes>
            <Route path="/results" element={<ResultsPage />} />
          </Routes>
        </MemoryRouter>
      </DarkModeContext.Provider>,
    );

    expect(asFragment()).toMatchSnapshot();
  });
});
