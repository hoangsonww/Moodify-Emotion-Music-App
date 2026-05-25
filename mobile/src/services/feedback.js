// Mobile client for POST /api/feedback/.
//
// Two surfaces, one endpoint -- same contract as the web client at
// frontend/src/services/feedback.js. Mirrored deliberately so a future
// schema change lands in both clients with no surprises.
//
// All sends are best-effort: feedback is telemetry and must never
// surface an error to the user. The promise resolves to a boolean
// (`true` on 2xx, `false` otherwise) and never throws.

import axios from 'axios';

import { API_URL } from '../../config';
import { isAuthenticated } from './auth';

const ENDPOINT = `${API_URL}/api/feedback/`;

// Canonical emotion labels accepted by the backend. Must stay in
// lockstep with modal_inference TEXT_EMOTION_LABELS + the neutral
// fallback (and with the web client's CANONICAL_EMOTIONS).
export const CANONICAL_EMOTIONS = [
  'joy',
  'love',
  'sadness',
  'anger',
  'fear',
  'neutral',
];

// The mobile mood palette uses friendlier labels (`happy`, `sad`, ...)
// than the backend's strict canonical set; collapse those before
// sending. Anything that can't be mapped falls through to null and is
// dropped (the field is optional, dropping it is safer than 400-ing
// the whole event).
const _EMOTION_ALIASES = {
  happy: 'joy',
  excited: 'joy',
  sad: 'sadness',
  angry: 'anger',
  fearful: 'fear',
  anxious: 'fear',
};

export function normalizeEmotion(value) {
  if (!value) return null;
  const v = String(value).trim().toLowerCase();
  if (!v) return null;
  if (CANONICAL_EMOTIONS.includes(v)) return v;
  if (_EMOTION_ALIASES[v]) return _EMOTION_ALIASES[v];
  return null;
}

export const INPUT_TYPES = ['text', 'speech', 'facial'];
export const TRACK_SIGNALS = ['like', 'unlike', 'open_deezer'];

/**
 * Send a mood-detection correction (or confirmation).
 *
 * @param {object} args
 * @param {string} args.predicted   -- the label the model returned.
 * @param {string} args.actual      -- the label the user says is correct.
 * @param {string} args.inputType   -- "text" | "speech" | "facial".
 * @param {number} [args.confidence] -- optional softmax prob for predicted.
 * @param {string} [args.sessionId] -- optional correlation id.
 * @returns {Promise<boolean>} true on 2xx, false otherwise. Never throws.
 */
export async function sendMoodFeedback({
  predicted,
  actual,
  inputType,
  confidence = null,
  sessionId = null,
}) {
  if (!isAuthenticated()) return false;
  if (!predicted || !actual || !inputType) return false;

  const normPredicted = normalizeEmotion(predicted);
  const normActual = normalizeEmotion(actual);
  if (!normPredicted || !normActual) return false;

  try {
    const res = await axios.post(ENDPOINT, {
      kind: 'mood',
      predicted: normPredicted,
      actual: normActual,
      input_type: inputType,
      confidence,
      session_id: sessionId,
    });
    return res.status >= 200 && res.status < 300;
  } catch {
    return false;
  }
}

/**
 * Send a track-level signal.
 *
 * @param {object} args
 * @param {object} args.track          -- full Deezer track dict.
 * @param {string} args.signal         -- "like" | "unlike" | "open_deezer".
 * @param {string} [args.contextEmotion] -- the mood the list was generated for.
 * @returns {Promise<boolean>}
 */
export async function sendTrackFeedback({ track, signal, contextEmotion = null }) {
  if (!isAuthenticated()) return false;
  if (!track || !signal) return false;

  const track_id = deriveTrackId(track);
  if (!track_id) return false;

  const normContext = normalizeEmotion(contextEmotion);

  try {
    const res = await axios.post(ENDPOINT, {
      kind: 'track',
      track_id,
      signal,
      context_emotion: normContext,
      track,
    });
    return res.status >= 200 && res.status < 300;
  } catch {
    return false;
  }
}

/**
 * Stable id for a Deezer track. Prefers the numeric id embedded in the
 * external_url; falls back to a name+artist key so listings without a
 * URL still produce a consistent key.
 */
export function deriveTrackId(track) {
  if (!track) return null;
  const url = track.external_url || track.url || '';
  const m = String(url).match(/\/track\/(\d+)/);
  if (m) return `deezer:${m[1]}`;
  if (track.id) return `deezer:${track.id}`;
  const name = (track.name || '').trim();
  const artist = (track.artist || '').trim();
  if (!name) return null;
  return `name:${name}::${artist}`;
}
