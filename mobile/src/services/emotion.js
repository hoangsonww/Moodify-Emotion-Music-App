// Emotion inference + user-data API client.
//
// Inference (text/speech/facial/music) goes directly to the Modal
// service; profile/history goes to the Django API. The axios interceptors
// (services/auth.js) attach the JWT and handle token refresh.

import axios from 'axios';

import { API_URL, MODAL_API_URL } from '../../config';

const TIMEOUT = 60000; // inference can incur a Modal cold start

/** Detect emotion from text. Returns { emotion, recommendations, ... }. */
export async function analyzeText(text) {
  const { data } = await axios.post(
    `${MODAL_API_URL}/text_emotion`,
    { text },
    { timeout: TIMEOUT },
  );
  return data;
}

async function analyzeMedia(endpoint, uri, type, name) {
  const form = new FormData();
  // React Native FormData file descriptor.
  form.append('file', { uri, type, name });
  // Content-Type (with boundary) is set by the platform for FormData.
  const { data } = await axios.post(`${MODAL_API_URL}/${endpoint}`, form, {
    timeout: TIMEOUT,
  });
  return data;
}

/** Detect emotion from a recorded audio clip (file uri). */
export function analyzeSpeech(uri) {
  return analyzeMedia('speech_emotion', uri, 'audio/m4a', 'recording.m4a');
}

/** Detect emotion from a captured photo (file uri). */
export function analyzeFace(uri) {
  return analyzeMedia('facial_emotion', uri, 'image/jpeg', 'photo.jpg');
}

/** Fetch fresh music recommendations for an emotion. */
export async function getRecommendations(emotion, market) {
  const { data } = await axios.post(
    `${MODAL_API_URL}/music_recommendation`,
    { emotion, market },
    { timeout: TIMEOUT },
  );
  return data;
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
  await axios.post(`${API_URL}/users/recommendations/${profileId}/`, {
    recommendations,
  });
}
