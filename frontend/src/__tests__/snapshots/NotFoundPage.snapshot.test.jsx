import React from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DarkModeContext } from "../../context/DarkModeContext";

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return { ...actual, useNavigate: () => jest.fn() };
});

import NotFoundPage from "../../pages/NotFoundPage";

describe("NotFoundPage snapshot", () => {
  it("matches the rendered markup", () => {
    const { asFragment } = render(
      <DarkModeContext.Provider value={{ isDarkMode: false }}>
        <MemoryRouter initialEntries={["/does-not-exist"]}>
          <NotFoundPage />
        </MemoryRouter>
      </DarkModeContext.Provider>,
    );

    expect(asFragment()).toMatchSnapshot();
  });
});
