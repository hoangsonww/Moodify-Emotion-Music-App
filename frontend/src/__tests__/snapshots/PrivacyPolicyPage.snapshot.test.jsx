import React from "react";
import { render } from "@testing-library/react";
import { DarkModeContext } from "../../context/DarkModeContext";
import PrivacyPolicyPage from "../../pages/PrivacyPolicyPage";

// LegalLayout stamps the current date ("Last updated ..."). Freeze "now" so the
// snapshot doesn't drift day to day, while keeping date parsing intact.
const RealDate = Date;
const FIXED_ISO = "2024-06-15T12:00:00.000Z";

beforeAll(() => {
  global.Date = class extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : [FIXED_ISO]));
    }
    static now() {
      return new RealDate(FIXED_ISO).getTime();
    }
  };
});

afterAll(() => {
  global.Date = RealDate;
});

describe("PrivacyPolicyPage snapshot", () => {
  it("matches the rendered markup", () => {
    const { asFragment } = render(
      <DarkModeContext.Provider value={{ isDarkMode: false }}>
        <PrivacyPolicyPage />
      </DarkModeContext.Provider>,
    );

    expect(asFragment()).toMatchSnapshot();
  });
});
