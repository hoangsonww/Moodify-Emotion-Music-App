// Central API configuration for Moodify.
//
// API_URL       -> Django REST API (auth, profiles/history, text + music
//                  proxy). In production this is the Vercel deployment.
// MODAL_API_URL -> Modal ML inference service. Speech and facial emotion
//                  uploads go directly here (no /api prefix, no trailing
//                  slash on endpoints).
//
// Override per environment with REACT_APP_API_URL / REACT_APP_MODAL_API_URL
// (set them in `frontend/.env` for local dev, and in the Vercel project's
// Environment Variables for deploys). The fallbacks below point at the
// real production deploys so a misconfigured build still works.

const stripTrailingSlash = (url) => (url || "").replace(/\/+$/, "");

export const API_URL =
  stripTrailingSlash(process.env.REACT_APP_API_URL) ||
  "https://moodify-backend-api.vercel.app";

export const MODAL_API_URL =
  stripTrailingSlash(process.env.REACT_APP_MODAL_API_URL) ||
  "https://hoangsonww--moodify-inference-inferenceservice-web.modal.run";
