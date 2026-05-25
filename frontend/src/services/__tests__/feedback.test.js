import axios from "axios";

import {
  deriveTrackId,
  normalizeEmotion,
  sendMoodFeedback,
  sendTrackFeedback,
} from "../feedback";

jest.mock("axios");

// Stub the auth helper -- both surfaces refuse to send when no token
// is in localStorage, and we don't want to drag in jwt-decode for the
// happy paths.
jest.mock("../auth", () => ({
  getToken: jest.fn(() => "tok"),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("normalizeEmotion", () => {
  it("passes through canonical labels", () => {
    expect(normalizeEmotion("joy")).toBe("joy");
    expect(normalizeEmotion("LOVE")).toBe("love");
    expect(normalizeEmotion(" neutral ")).toBe("neutral");
  });

  it("collapses UI aliases", () => {
    expect(normalizeEmotion("happy")).toBe("joy");
    expect(normalizeEmotion("sad")).toBe("sadness");
    expect(normalizeEmotion("angry")).toBe("anger");
    expect(normalizeEmotion("fearful")).toBe("fear");
  });

  it("drops unknown labels to null", () => {
    expect(normalizeEmotion("ecstatic")).toBeNull();
    expect(normalizeEmotion("")).toBeNull();
    expect(normalizeEmotion(null)).toBeNull();
  });
});

describe("deriveTrackId", () => {
  it("pulls the numeric id from a Deezer URL", () => {
    expect(
      deriveTrackId({ external_url: "https://www.deezer.com/track/916424" }),
    ).toBe("deezer:916424");
  });

  it("falls back to id field", () => {
    expect(deriveTrackId({ id: 42 })).toBe("deezer:42");
  });

  it("falls back to name+artist when nothing else is present", () => {
    expect(deriveTrackId({ name: "Song A", artist: "Artist A" })).toBe(
      "name:Song A::Artist A",
    );
  });

  it("returns null when there is nothing to key on", () => {
    expect(deriveTrackId(null)).toBeNull();
    expect(deriveTrackId({})).toBeNull();
  });
});

describe("sendMoodFeedback", () => {
  it("POSTs the canonical payload", async () => {
    axios.post.mockResolvedValueOnce({ status: 202 });
    const ok = await sendMoodFeedback({
      predicted: "joy",
      actual: "love",
      inputType: "text",
      confidence: 0.82,
      sessionId: "sess-1",
    });
    expect(ok).toBe(true);
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining("/api/feedback/"),
      {
        kind: "mood",
        predicted: "joy",
        actual: "love",
        input_type: "text",
        confidence: 0.82,
        session_id: "sess-1",
      },
      expect.objectContaining({
        headers: { Authorization: "Bearer tok" },
      }),
    );
  });

  it("returns false on network error (never throws)", async () => {
    axios.post.mockRejectedValueOnce(new Error("boom"));
    const ok = await sendMoodFeedback({
      predicted: "joy",
      actual: "love",
      inputType: "text",
    });
    expect(ok).toBe(false);
  });

  it("refuses to send when required fields are missing", async () => {
    const ok = await sendMoodFeedback({ predicted: "joy" });
    expect(ok).toBe(false);
    expect(axios.post).not.toHaveBeenCalled();
  });
});

describe("sendTrackFeedback", () => {
  const track = {
    name: "Song A",
    artist: "Artist A",
    external_url: "https://www.deezer.com/track/12345",
    duration_ms: 200_000,
    popularity: 75,
  };

  it("POSTs the canonical track payload with derived id", async () => {
    axios.post.mockResolvedValueOnce({ status: 202 });
    const ok = await sendTrackFeedback({
      track,
      signal: "like",
      contextEmotion: "joy",
    });
    expect(ok).toBe(true);
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining("/api/feedback/"),
      {
        kind: "track",
        track_id: "deezer:12345",
        signal: "like",
        context_emotion: "joy",
        track,
      },
      expect.any(Object),
    );
  });

  it("returns false when the track has no identifiable id", async () => {
    const ok = await sendTrackFeedback({ track: {}, signal: "like" });
    expect(ok).toBe(false);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("returns false on network error", async () => {
    axios.post.mockRejectedValueOnce(new Error("boom"));
    const ok = await sendTrackFeedback({ track, signal: "like" });
    expect(ok).toBe(false);
  });

  it("refuses when signal missing", async () => {
    const ok = await sendTrackFeedback({ track });
    expect(ok).toBe(false);
    expect(axios.post).not.toHaveBeenCalled();
  });
});
