import React from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DarkModeContext } from "../../context/DarkModeContext";

// The procedural 3D background probes WebGL via canvas.getContext, which jsdom
// can't provide. Stub it so the snapshot is stable and free of WebGL noise.
jest.mock("../../components/PageBackground", () => () => (
  <div data-testid="page-background-mock" />
));

// react-slick renders a carousel that depends on layout measurement; replace
// it with a no-op so the markup is deterministic.
jest.mock("react-slick", () => () => <div data-testid="slider-mock" />);

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return { ...actual, useNavigate: () => jest.fn() };
});

import LandingPage from "../../pages/LandingPage";

describe("LandingPage snapshot", () => {
  it("matches the rendered markup", () => {
    const { asFragment } = render(
      <DarkModeContext.Provider value={{ isDarkMode: false }}>
        <MemoryRouter initialEntries={["/"]}>
          <LandingPage />
        </MemoryRouter>
      </DarkModeContext.Provider>,
    );

    expect(asFragment()).toMatchSnapshot();
  });
});
