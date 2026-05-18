// Central API configuration for Moodify.
//
// API_URL       -> Django REST API (auth, profiles/history, text + music
//                  proxy). In production this is the Vercel deployment.
// MODAL_API_URL -> Modal ML inference service. Speech and facial emotion
//                  uploads go directly here (no /api prefix, no trailing
//                  slash on endpoints).
//
// Override per environment with REACT_APP_API_URL / REACT_APP_MODAL_API_URL.

const stripTrailingSlash = (url) => (url || "").replace(/\/+$/, "");

export const API_URL =
  stripTrailingSlash(process.env.REACT_APP_API_URL) ||
  "https://moodify-emotion-music-app.onrender.com";

export const MODAL_API_URL = stripTrailingSlash(
  process.env.REACT_APP_MODAL_API_URL,
);
