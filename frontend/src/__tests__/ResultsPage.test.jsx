import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ResultsPage from "../pages/ResultsPage";
import { DarkModeContext } from "../context/DarkModeContext";
import axios from "axios";
import { MemoryRouter, Routes, Route } from "react-router-dom";

jest.mock("axios");

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

  it("renders detected mood and initial recommendation cards", () => {
    setup();

    // 1) the label node
    expect(screen.getByText(/Detected Mood:/i)).toBeInTheDocument();

    // 2) the <span> that shows the capitalized mood
    expect(screen.getByText("Happy", { selector: "span" })).toBeInTheDocument();

    // Recommendation cards
    expect(screen.getByText("Song A")).toBeInTheDocument();
    expect(screen.getByText("Artist A")).toBeInTheDocument();
    expect(screen.getByText("Song B")).toBeInTheDocument();
    expect(screen.getByText("Artist B")).toBeInTheDocument();
  });

  it("updates recommendations when mood is changed", async () => {
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

    const [moodSelect] = screen.getAllByRole("combobox");
    fireEvent.mouseDown(moodSelect);
    const joyOption = await screen.findByRole("option", { name: /^Joy$/i });
    fireEvent.click(joyOption);

    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining("/api/music_recommendation/"),
        { emotion: "joy", market: undefined },
      ),
    );

    expect(await screen.findByText("Song C")).toBeInTheDocument();
    expect(screen.getByText("Artist C")).toBeInTheDocument();
  });

  it("updates recommendations when region is changed", async () => {
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

    const [, regionSelect] = screen.getAllByRole("combobox");
    fireEvent.mouseDown(regionSelect);
    const usOption = await screen.findByRole("option", {
      name: /United States/i,
    });
    fireEvent.click(usOption);

    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining("/api/music_recommendation/"),
        { emotion: "happy", market: "US" },
      ),
    );

    expect(await screen.findByText("Song D")).toBeInTheDocument();
    expect(screen.getByText("Artist D")).toBeInTheDocument();
  });
});
