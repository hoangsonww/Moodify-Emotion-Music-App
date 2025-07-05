import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { DarkModeContext } from "../context/DarkModeContext";

// Mock react-slick as a no-op component
jest.mock("react-slick", () => () => <div data-testid="slider-mock" />);

// Mock useNavigate so we can verify navigation
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import LandingPage from "../pages/LandingPage";

describe("LandingPage (minimal)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderLanding = () =>
    render(
      <DarkModeContext.Provider value={{ isDarkMode: false }}>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
          </Routes>
        </MemoryRouter>
      </DarkModeContext.Provider>,
    );

  it("shows hero title and subtitle", () => {
    renderLanding();
    expect(
      screen.getByRole("heading", { level: 3, name: /Welcome to Moodify/i }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/AI-powered emotion-based music recommendation app/i),
    ).toBeInTheDocument();
  });

  it("renders Get Started and Log In buttons and navigates on click", () => {
    renderLanding();

    const startBtn = screen.getByRole("button", { name: /Get Started/i });
    const loginBtn = screen.getByRole("button", { name: /Log In/i });

    expect(startBtn).toBeInTheDocument();
    expect(loginBtn).toBeInTheDocument();

    fireEvent.click(startBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/register");

    fireEvent.click(loginBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });

  it("renders the Features section heading", () => {
    renderLanding();
    expect(
      screen.getByRole("heading", { level: 4, name: /Features/i }),
    ).toBeInTheDocument();
  });
});
