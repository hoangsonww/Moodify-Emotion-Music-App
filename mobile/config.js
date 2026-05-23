// API configuration for the Moodify mobile app.
//
// API_URL       -> Django REST API (auth, profile, history).
// MODAL_API_URL -> Modal ML inference service (text/speech/facial emotion
//                  + music recommendation), called directly.
//
// Override per build with the Expo public env vars EXPO_PUBLIC_API_URL /
// EXPO_PUBLIC_MODAL_API_URL (set them in `mobile/.env` for local Expo Go
// development, or via `eas env:create ...` for production builds). The
// fallbacks below point at the real production deploys so the app still
// works when the env vars are not set.

const stripTrailingSlash = (url) => (url || '').replace(/\/+$/, '');

export const API_URL =
  stripTrailingSlash(process.env.EXPO_PUBLIC_API_URL) ||
  'https://moodify-backend-api.vercel.app';

export const MODAL_API_URL =
  stripTrailingSlash(process.env.EXPO_PUBLIC_MODAL_API_URL) ||
  'https://hoangsonww--moodify-inference-inferenceservice-web.modal.run';
