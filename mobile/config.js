// Central API configuration for the Moodify mobile app.
//
// API_URL       -> Django REST API (auth, profiles/history, text + music).
// MODAL_API_URL -> Modal ML inference service (speech + facial emotion).
//
// Override per environment with the Expo public env vars
// EXPO_PUBLIC_API_URL / EXPO_PUBLIC_MODAL_API_URL.

const stripTrailingSlash = (url) => (url || '').replace(/\/+$/, '');

export const API_URL =
  stripTrailingSlash(process.env.EXPO_PUBLIC_API_URL) || 'http://127.0.0.1:8000';

export const MODAL_API_URL = stripTrailingSlash(
  process.env.EXPO_PUBLIC_MODAL_API_URL,
);
