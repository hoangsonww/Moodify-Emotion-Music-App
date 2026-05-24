// Thin client for POST /api/feedback/.
//
// Two surfaces, one endpoint:
//
//   * sendMoodFeedback({ predicted, actual, input_type, ... })
//     -- user agreed or corrected a detected emotion.
//
//   * sendTrackFeedback({ track, signal, context_emotion })
//     -- 👍 / 👎 / open-in-Deezer on a recommendation.
//
// Authenticated only -- anonymous callers can't be addressed by the
// per-user calibration map or bandit posterior, so we just no-op when
// the JWT is absent. Network failures are swallowed: feedback is
// telemetry, not a critical write.

import axios from "axios";

import { API_URL } from "../config";
import { getToken } from "./auth";

const ENDPOINT = `${API_URL}/api/feedback/`;

// Canonical emotion labels accepted by the backend (matches
// modal_inference TEXT_EMOTION_LABELS + the neutral fallback).
export const CANONICAL_EMOTIONS = [
  "joy",
  "love",
  "sadness",
  "anger",
  "fear",
  "neutral",
];

// Common UI labels that are NOT in the canonical set -- the results
// page palette uses "happy", "sad", etc. for friendlier copy. The
// backend validator is strict, so we collapse synonyms back to the
// canonical label here. Anything not in either map is dropped (the
// field is optional, dropping it is safer than 400-ing the event).
const _EMOTION_ALIASES = {
  happy: "joy",
  excited: "joy",
  sad: "sadness",
  angry: "anger",
  fearful: "fear",
  anxious: "fear",
  // The remaining palette keys (surprise, surprised, calm, disgust)
  // don't have a clean canonical mapping; they fall through to null
  // and the backend just sees no context emotion for that event.
};

export function normalizeEmotion(value) {
  if (!value) return null;
  const v = String(value).trim().toLowerCase();
  if (!v) return null;
  if (CANONICAL_EMOTIONS.includes(v)) return v;
  if (_EMOTION_ALIASES[v]) return _EMOTION_ALIASES[v];
  return null;
}

// What the backend recognises as the input modality for a mood
// correction. Keep in lockstep with feedback_store.INPUT_TYPES.
export const INPUT_TYPES = ["text", "speech", "facial"];

// What the backend recognises as a per-track signal. Keep in lockstep
// with feedback_store.TRACK_SIGNALS.
export const TRACK_SIGNALS = ["like", "unlike", "open_deezer"];

function authHeaders() {
  const token = getToken();
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
}

/**
 * Send a mood-detection correction (or confirmation).
 *
 * @param {object} args
 * @param {string} args.predicted   -- the label the model returned.
 * @param {string} args.actual      -- the label the user says is correct.
 * @param {string} args.inputType   -- "text" | "speech" | "facial".
 * @param {number} [args.confidence] -- optional softmax prob for predicted.
 * @param {string} [args.sessionId] -- optional client-side session id.
 * @returns {Promise<boolean>} true on 2xx, false otherwise. Never throws.
 */
export async function sendMoodFeedback({
  predicted,
  actual,
  inputType,
  confidence = null,
  sessionId = null,
}) {
  const headers = authHeaders();
  if (!headers) return false;
  if (!predicted || !actual || !inputType) return false;

  // Backend rejects non-canonical labels with 400 -- collapse synonyms
  // before sending so the UI's friendlier labels still produce valid
  // feedback events.
  const normPredicted = normalizeEmotion(predicted);
  const normActual = normalizeEmotion(actual);
  if (!normPredicted || !normActual) return false;

  try {
    const res = await axios.post(
      ENDPOINT,
      {
        kind: "mood",
        predicted: normPredicted,
        actual: normActual,
        input_type: inputType,
        confidence,
        session_id: sessionId,
      },
      { headers, _skipAuthRefresh: false },
    );
    return res.status >= 200 && res.status < 300;
  } catch {
    return false;
  }
}

/**
 * Send a track-level signal.
 *
 * @param {object} args
 * @param {object} args.track          -- full Deezer track dict (so the
 *                                        backend can update the bandit
 *                                        posterior, not just the log).
 * @param {string} args.signal         -- "like" | "unlike" | "open_deezer".
 * @param {string} [args.contextEmotion] -- the mood the list was generated for.
 * @returns {Promise<boolean>} true on 2xx, false otherwise. Never throws.
 */
export async function sendTrackFeedback({
  track,
  signal,
  contextEmotion = null,
}) {
  const headers = authHeaders();
  if (!headers) return false;
  if (!track || !signal) return false;

  // Build a stable track_id so the backend log can dedupe across
  // calls. Deezer doesn't include the numeric id in the dict the
  // recommender returns, but the external_url does; fall back to
  // name+artist if even that is missing.
  const track_id = deriveTrackId(track);
  if (!track_id) return false;

  // Normalise the context emotion -- a UI label like "happy" would
  // otherwise 400 at the backend validator and we'd lose the signal.
  const normContext = normalizeEmotion(contextEmotion);

  try {
    const res = await axios.post(
      ENDPOINT,
      {
        kind: "track",
        track_id,
        signal,
        context_emotion: normContext,
        track,
      },
      { headers, _skipAuthRefresh: false },
    );
    return res.status >= 200 && res.status < 300;
  } catch {
    return false;
  }
}

/**
 * Stable id for a Deezer track. Prefers the numeric id embedded in the
 * external_url; falls back to "name::artist" so listings without a URL
 * still produce a consistent key.
 */
export function deriveTrackId(track) {
  if (!track) return null;
  const url = track.external_url || track.url || "";
  const m = String(url).match(/\/track\/(\d+)/);
  if (m) return `deezer:${m[1]}`;
  if (track.id) return `deezer:${track.id}`;
  const name = (track.name || "").trim();
  const artist = (track.artist || "").trim();
  if (!name) return null;
  return `name:${name}::${artist}`;
}
