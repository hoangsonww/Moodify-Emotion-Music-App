import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import HomePage from "../pages/HomePage";
import { DarkModeContext } from "../context/DarkModeContext";
import axios from "axios";
import { MemoryRouter } from "react-router-dom";

jest.mock("axios");

// The Toast context is consumed by HomePage; provide a no-op stub so
// tests don't fail on a missing provider.
jest.mock("../components/Toast", () => ({
  useToast: () => ({
    show: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  }),
}));

const renderHome = () =>
  render(
    <DarkModeContext.Provider value={{ isDarkMode: false }}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </DarkModeContext.Provider>,
  );

describe("<HomePage />", () => {
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

  it("renders the three mode tiles with the new card layout", async () => {
    renderHome();
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));

    // Mode tiles are Paper cards with a label + blurb. Match the label text.
    expect(screen.getByText(/^Text$/)).toBeInTheDocument();
    expect(screen.getByText(/^Voice$/)).toBeInTheDocument();
    expect(screen.getByText(/^Face$/)).toBeInTheDocument();

    // Initial primary CTA is the text-mode "Add Text" button.
    expect(
      screen.getByRole("button", { name: /Add Text/i }),
    ).toBeInTheDocument();

    // Upload counterpart for the text mode.
    expect(
      screen.getByRole("button", { name: /Upload Text File/i }),
    ).toBeInTheDocument();
  });

  it("switches to face mode when the Face tile is clicked", async () => {
    renderHome();
    await waitFor(() => expect(axios.get).toHaveBeenCalled());

    // Click the Face mode tile (text node is inside a Paper card).
    fireEvent.click(screen.getByText(/^Face$/));

    // Action zone CTA flips to "Capture Image".
    expect(
      screen.getByRole("button", { name: /Capture Image/i }),
    ).toBeInTheDocument();

    // Upload button now opens a modal that owns the file input. Click it
    // and assert the modal-mounted picker accepts image/*.
    const uploadButton = screen.getByRole("button", {
      name: /Upload Image/i,
    });
    expect(uploadButton).toBeInTheDocument();
    fireEvent.click(uploadButton);

    // The modal's hidden <input type="file"> is the only file picker in
    // the tree, so query by type instead of an id (the legacy
    // `upload-file` id no longer exists).
    await waitFor(() => {
      expect(
        document.querySelector('input[type="file"]'),
      ).toBeInTheDocument();
    });
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toHaveAttribute("accept", "image/*");
  });
});
