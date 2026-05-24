// Recommendations / text-emotion service.
//
// Two routings:
//   * Authenticated callers go through the Django proxy
//     (POST /api/text_emotion/, POST /api/music_recommendation/) so the
//     bandit re-ranker + per-user mood calibration map can act on the
//     response.
//   * Anonymous callers go straight to Modal -- there is nothing
//     personalised to apply, so the extra Django hop would just be
//     latency.
//
// Speech and facial uploads always hit Modal directly: they're large
// multipart bodies and Vercel's request size cap would reject them at
// the Django edge. That's the long-standing pattern documented in
// modal_inference/README.md §3.

import axios from "axios";

import { API_URL, MODAL_API_URL } from "../config";
import { isAuthenticated } from "./auth";

const DJANGO_TEXT_PATH = "/api/text_emotion/";
const DJANGO_MUSIC_PATH = "/api/music_recommendation/";
const MODAL_TEXT_PATH = "/text_emotion";
const MODAL_MUSIC_PATH = "/music_recommendation";

// Axios derives Content-Type from JSON bodies automatically, and the
// global request interceptor in services/auth.js attaches the bearer
// token to every request, so neither call site needs an explicit
// headers object. ``token`` is accepted for forwards compatibility with
// callers that have a fresh-from-login token before localStorage settles.
function maybeAuth(token) {
  if (!token) return undefined;
  return { headers: { Authorization: `Bearer ${token}` } };
}

function _post(url, body, cfg) {
  // Drop the third arg entirely when there's no auth override -- older
  // call sites and tests assert on a 2-arg axios.post signature.
  return cfg ? axios.post(url, body, cfg) : axios.post(url, body);
}

/**
 * POST a text-emotion request, routing to Django when authed.
 */
export function detectTextEmotion({ text, token = null }) {
  const cfg = maybeAuth(token);
  if (isAuthenticated()) {
    return _post(`${API_URL}${DJANGO_TEXT_PATH}`, { text }, cfg);
  }
  return _post(`${MODAL_API_URL}${MODAL_TEXT_PATH}`, { text }, cfg);
}

/**
 * POST a music-recommendation request, routing to Django when authed.
 */
export function getRecommendations({
  emotion,
  market,
  history,
  genre,
  token = null,
}) {
  const payload = {
    emotion: String(emotion || "neutral").toLowerCase(),
    // Always include history (even empty) so the backend's
    // recurring-mood blend gets a well-formed list and so callers that
    // assert on the request body don't break on the empty case.
    history: Array.isArray(history) ? history : [],
  };
  if (market) payload.market = market;
  if (genre) payload.genre = genre;

  const cfg = maybeAuth(token);
  if (isAuthenticated()) {
    return _post(`${API_URL}${DJANGO_MUSIC_PATH}`, payload, cfg);
  }
  return _post(`${MODAL_API_URL}${MODAL_MUSIC_PATH}`, payload, cfg);
}
