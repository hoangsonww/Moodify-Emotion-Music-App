import React from "react";
import { render, screen } from "@testing-library/react";
import RecommendationsPage from "../pages/RecommendationsPage";

describe("<RecommendationsPage />", () => {
  beforeEach(() => {
    render(<RecommendationsPage />);
  });

  it("renders the main heading and description", () => {
    expect(
      screen.getByRole("heading", { level: 1, name: /Music Recommendations/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Here are some music recommendations based on your mood:/i,
      ),
    ).toBeInTheDocument();
  });

  it("renders three track cards with titles and artists", () => {
    // Track titles
    expect(
      screen.getByRole("heading", { level: 3, name: /Track 1/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: /Track 2/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: /Track 3/i }),
    ).toBeInTheDocument();

    // Artist paragraphs
    expect(screen.getByText(/Artist:\s*Artist 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Artist:\s*Artist 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Artist:\s*Artist 3/i)).toBeInTheDocument();
  });

  it("includes three audio players with correct sources", () => {
    const audioElements = document.querySelectorAll("audio");
    expect(audioElements).toHaveLength(3);

    const sourceElements = document.querySelectorAll("audio source");
    expect(sourceElements).toHaveLength(3);
    expect(sourceElements[0]).toHaveAttribute("src", "track1.mp3");
    expect(sourceElements[1]).toHaveAttribute("src", "track2.mp3");
    expect(sourceElements[2]).toHaveAttribute("src", "track3.mp3");
    sourceElements.forEach((srcEl) =>
      expect(srcEl).toHaveAttribute("type", "audio/mpeg"),
    );
  });

  it("renders three Spotify links with correct text and target", () => {
    const links = screen.getAllByRole("link", { name: /Listen on Spotify/i });
    expect(links).toHaveLength(3);
    links.forEach((link) => {
      expect(link).toHaveAttribute("href", "https://open.spotify.com");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noreferrer");
    });
  });
});
