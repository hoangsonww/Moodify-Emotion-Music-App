import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import HomePage from "../pages/HomePage";
import { DarkModeContext } from "../context/DarkModeContext";
import axios from "axios";
import { MemoryRouter } from "react-router-dom";

jest.mock("axios");

describe("<HomePage />", () => {
  beforeEach(() => {
    // Provide a token so the useEffect fetchUserData path runs
    window.localStorage.setItem("token", "fake-jwt-token");

    // Mock the GET for user profile
    axios.get.mockResolvedValue({
      data: { id: "user-123", name: "Test User" },
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
    window.localStorage.clear();
  });

  it("renders the three mode tabs and initial text prompt", async () => {
    render(
      <DarkModeContext.Provider value={{ isDarkMode: false }}>
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      </DarkModeContext.Provider>,
    );

    // wait for the axios.get call
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));

    // Only the exact-labeled tabs, not other buttons
    expect(screen.getByRole("button", { name: /^Text$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Face$/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Speech$/ }),
    ).toBeInTheDocument();

    // Confirm the prompt shows the activeTab
    expect(
      screen.getByText(/Choose an input mode \(text\)/i),
    ).toBeInTheDocument();
  });

  it("switches to face mode when Face tab clicked", async () => {
    render(
      <DarkModeContext.Provider value={{ isDarkMode: false }}>
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      </DarkModeContext.Provider>,
    );

    // wait for initial fetch
    await waitFor(() => expect(axios.get).toHaveBeenCalled());

    // Click the Face tab
    fireEvent.click(screen.getByRole("button", { name: /^Face$/ }));

    // Now the prompt should update to (face)
    expect(
      screen.getByText(/Choose an input mode \(face\)/i),
    ).toBeInTheDocument();

    // The file input accept attribute should reflect image uploads
    const fileInput = screen.getByLabelText(/Upload Image/i).closest("input");
    expect(fileInput).toHaveAttribute("accept", "image/*");
  });
});
