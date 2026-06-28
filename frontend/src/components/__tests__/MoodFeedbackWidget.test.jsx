import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import MoodFeedbackWidget from "../MoodFeedbackWidget";

jest.mock("../../services/auth", () => ({
  isAuthenticated: jest.fn(() => true),
}));

jest.mock("../../services/feedback", () => ({
  CANONICAL_EMOTIONS: ["joy", "love", "sadness", "anger", "fear", "neutral"],
  sendMoodFeedback: jest.fn(() => Promise.resolve(true)),
}));

const { isAuthenticated } = require("../../services/auth");
const { sendMoodFeedback } = require("../../services/feedback");

beforeEach(() => {
  jest.clearAllMocks();
  isAuthenticated.mockReturnValue(true);
  sendMoodFeedback.mockResolvedValue(true);
});

describe("<MoodFeedbackWidget />", () => {
  it("renders nothing for anonymous users", () => {
    isAuthenticated.mockReturnValue(false);
    const { container } = render(
      <MoodFeedbackWidget predicted="joy" inputType="text" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when predicted is empty", () => {
    const { container } = render(
      <MoodFeedbackWidget predicted="" inputType="text" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows the ask prompt and three actions in the default state", () => {
    render(<MoodFeedbackWidget predicted="joy" inputType="text" />);
    expect(screen.getByText(/Was that right\?/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Yes$/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /No, it was/ }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Skip feedback/i)).toBeInTheDocument();
  });

  it("Yes confirms with predicted=actual and transitions to done", async () => {
    render(<MoodFeedbackWidget predicted="joy" inputType="text" />);
    fireEvent.click(screen.getByRole("button", { name: /^Yes$/ }));
    await waitFor(() =>
      expect(sendMoodFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          predicted: "joy",
          actual: "joy",
          inputType: "text",
        }),
      ),
    );
    expect(await screen.findByText(/Thanks/i)).toBeInTheDocument();
  });

  it("No opens the chip strip and a chip click sends the correction", async () => {
    const onCorrected = jest.fn();
    render(
      <MoodFeedbackWidget
        predicted="joy"
        inputType="text"
        onCorrected={onCorrected}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /No, it was/ }));
    // The chip strip filters out the predicted label.
    expect(screen.queryByText(/^Joy$/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(/^Love$/));
    await waitFor(() =>
      expect(sendMoodFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          predicted: "joy",
          actual: "love",
          inputType: "text",
        }),
      ),
    );
    expect(onCorrected).toHaveBeenCalledWith("love");
    expect(await screen.findByText(/Thanks/i)).toBeInTheDocument();
  });

  it("shows a loading spinner while the confirmation is in flight", async () => {
    let resolveSend;
    sendMoodFeedback.mockReturnValue(
      new Promise((resolve) => {
        resolveSend = resolve;
      }),
    );
    render(<MoodFeedbackWidget predicted="joy" inputType="text" />);
    fireEvent.click(screen.getByRole("button", { name: /^Yes$/ }));
    // Request is pending -> a progress indicator is visible.
    expect(await screen.findByRole("progressbar")).toBeInTheDocument();
    resolveSend(true);
    expect(await screen.findByText(/Thanks/i)).toBeInTheDocument();
  });

  it("shows a saving spinner while a correction is in flight", async () => {
    let resolveSend;
    sendMoodFeedback.mockReturnValue(
      new Promise((resolve) => {
        resolveSend = resolve;
      }),
    );
    render(<MoodFeedbackWidget predicted="joy" inputType="text" />);
    fireEvent.click(screen.getByRole("button", { name: /No, it was/ }));
    fireEvent.click(screen.getByText(/^Love$/));
    expect(await screen.findByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByText(/Saving your feedback/i)).toBeInTheDocument();
    resolveSend(true);
    expect(await screen.findByText(/Thanks/i)).toBeInTheDocument();
  });

  it("X dismisses the widget entirely (no Thanks, no send)", () => {
    const { container } = render(
      <MoodFeedbackWidget predicted="joy" inputType="text" />,
    );
    fireEvent.click(screen.getByLabelText(/Skip feedback/i));
    // Dismiss removes the widget outright -- it must NOT fall into the
    // "Thanks" terminal state (skipping is not feedback).
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/Thanks/i)).not.toBeInTheDocument();
    expect(sendMoodFeedback).not.toHaveBeenCalled();
  });
});
