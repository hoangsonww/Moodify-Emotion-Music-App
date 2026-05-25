// Emotion inference + user-data API client.
//
// Inference (text/speech/facial/music) goes directly to the Modal
// service; profile/history goes to the Django API. The axios interceptors
// (services/auth.js) attach the JWT and handle token refresh.
//
// The inference calls NEVER throw: on any failure they return a graceful
// fallback result, so the UI never has to surface an error to the user.

import axios from 'axios';

import { API_URL, MODAL_API_URL } from '../../config';
import { isAuthenticated } from './auth';

const TIMEOUT = 60000; // inference can incur a Modal cold start

// Authed callers hit Django so the per-user calibration map +
// Thompson-Sampling bandit re-rank can act on the response. Anonymous
// callers stay on the direct Modal path -- there is nothing to
// personalise for them, so the extra hop would just be latency.
function textEmotionUrl() {
  return isAuthenticated()
    ? `${API_URL}/api/text_emotion/`
    : `${MODAL_API_URL}/text_emotion`;
}

function musicRecommendationUrl() {
  return isAuthenticated()
    ? `${API_URL}/api/music_recommendation/`
    : `${MODAL_API_URL}/music_recommendation`;
}

// No client-side track fallback. Returning a hard-coded list when the
// recommender was slow / unreachable was actively misleading: users
// saw the same 14 generic tracks every time the Modal proxy timed
// out, even when the real result eventually came back fine upstream.
// We now return an empty list + a `degraded: true` flag and let the
// UI surface "couldn't load" honestly. Kept exported as an empty
// array so any consumer importing the symbol still resolves.
export const FALLBACK_TRACKS = [];

const fallbackResult = (emotion = 'calm') => ({
  emotion,
  recommendations: [],
  degraded: true,
});

/** Detect emotion from text. Always resolves to {emotion, recommendations}. */
export async function analyzeText(text) {
  try {
    const { data } = await axios.post(
      textEmotionUrl(),
      { text },
      { timeout: TIMEOUT },
    );
    return data;
  } catch (e) {
    return fallbackResult();
  }
}

async function analyzeMedia(path, uri, type, name) {
  try {
    const form = new FormData();
    // React Native FormData file descriptor.
    form.append('file', { uri, type, name });
    const { data } = await axios.post(`${MODAL_API_URL}${path}`, form, { timeout: TIMEOUT });
    return data;
  } catch (e) {
    return fallbackResult();
  }
}

/** Detect emotion from a recorded audio clip (file uri). */
export function analyzeSpeech(uri) {
  return analyzeMedia('/speech_emotion', uri, 'audio/m4a', 'recording.m4a');
}

/** Detect emotion from a captured photo (file uri). */
export function analyzeFace(uri) {
  return analyzeMedia('/facial_emotion', uri, 'image/jpeg', 'photo.jpg');
}

/**
 * Fetch recommendations for an emotion (optionally market-scoped).
 *
 * `history` is the user's recent detected moods (oldest first); when given,
 * the service blends in tracks for their recurring mood.
 */
export async function getRecommendations(emotion, market, history) {
  try {
    const { data } = await axios.post(
      musicRecommendationUrl(),
      {
        emotion,
        market: market || undefined,
        history: Array.isArray(history) ? history.slice(-50) : [],
      },
      { timeout: TIMEOUT },
    );
    return data;
  } catch (e) {
    // Honest degraded state -- empty list + flag. The UI's EmptyState
    // already renders a "no tracks" pane with a Shuffle CTA, which is
    // a better signal than 14 unrelated stand-ins.
    return { emotion, market, recommendations: [], degraded: true };
  }
}

/** The authenticated user's profile (id, username, history, ...). */
export async function getProfile() {
  const { data } = await axios.get(`${API_URL}/users/user/profile/`);
  return data;
}

/** Append a detected mood to the user's history (best effort). */
export async function saveMood(profileId, mood) {
  await axios.post(`${API_URL}/users/mood_history/${profileId}/`, { mood });
}

/** Append recommendations to the user's history (best effort). */
export async function saveRecommendations(profileId, recommendations) {
  await axios.post(`${API_URL}/users/recommendations/${profileId}/`, { recommendations });
}

/**
 * Log that the user opened/played a track. The backend stores listening
 * history as strings, so the track is serialised as "Name — Artist".
 */
export async function saveListening(profileId, track) {
  if (!profileId || !track?.name) return;
  const entry = track.artist ? `${track.name} — ${track.artist}` : track.name;
  await axios.post(`${API_URL}/users/listening_history/${profileId}/`, { track: entry });
}

/**
 * Clear all entries from one of the per-user history lists.
 *
 * `recommendations` has a bulk DELETE endpoint; `mood_history` and
 * `listening_history` only delete one entry at a time, so we fetch the
 * current list and issue one DELETE per entry (typical histories are
 * small enough that this is fine).
 */
export async function clearHistory(profileId, kind) {
  if (!profileId) return;
  if (kind === 'recommendations') {
    await axios.delete(`${API_URL}/users/recommendations/${profileId}/`);
    return;
  }
  const profile = await getProfile();
  const entryKey = kind === 'mood_history' ? 'mood' : 'track';
  const items = profile?.[kind] || [];
  for (const item of items) {
    try {
      await axios.delete(`${API_URL}/users/${kind}/${profileId}/`, {
        data: { [entryKey]: item },
      });
    } catch {
      // best-effort: keep clearing the rest
    }
  }
}
