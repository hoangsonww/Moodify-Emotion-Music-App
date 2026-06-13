import React from "react";
import { render } from "@testing-library/react";
import RecommendationsPage from "../../pages/RecommendationsPage";

describe("RecommendationsPage snapshot", () => {
  it("matches the rendered markup", () => {
    const { asFragment } = render(<RecommendationsPage />);
    expect(asFragment()).toMatchSnapshot();
  });
});
