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

const TIMEOUT = 60000; // inference can incur a Modal cold start

// Curated last-resort tracks for when the service is unreachable. The
// external_url is a Spotify search link, so it always resolves.
const _FALLBACK = [
  ['Blinding Lights', 'The Weeknd'],
  ['Levitating', 'Dua Lipa'],
  ['As It Was', 'Harry Styles'],
  ['good 4 u', 'Olivia Rodrigo'],
  ['Sunflower', 'Post Malone, Swae Lee'],
  ['Uptown Funk', 'Mark Ronson, Bruno Mars'],
  ['Someone Like You', 'Adele'],
  ['Counting Stars', 'OneRepublic'],
  ['Stay', 'The Kid LAROI, Justin Bieber'],
  ['Shape of You', 'Ed Sheeran'],
  ['Believer', 'Imagine Dragons'],
  ['Riptide', 'Vance Joy'],
  ['Heat Waves', 'Glass Animals'],
  ["Don't Start Now", 'Dua Lipa'],
];

export const FALLBACK_TRACKS = _FALLBACK.map(([name, artist]) => ({
  name,
  artist,
  album: null,
  preview_url: null,
  external_url: 'https://open.spotify.com/search/' + encodeURIComponent(`${name} ${artist}`),
  image_url: null,
  popularity: 0,
  duration_ms: 0,
  release_date: null,
}));

const fallbackResult = (emotion = 'calm') => ({
  emotion,
  recommendations: FALLBACK_TRACKS,
  degraded: true,
});

/** Detect emotion from text. Always resolves to {emotion, recommendations}. */
export async function analyzeText(text) {
  try {
    const { data } = await axios.post(
      `${MODAL_API_URL}/text_emotion`,
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
      `${MODAL_API_URL}/music_recommendation`,
      {
        emotion,
        market: market || undefined,
        history: Array.isArray(history) ? history.slice(-50) : [],
      },
      { timeout: TIMEOUT },
    );
    return data;
  } catch (e) {
    return { emotion, market, recommendations: FALLBACK_TRACKS };
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
