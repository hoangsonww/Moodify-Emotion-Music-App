// Best-effort logging of user track interactions. Both the preview-play
// button and the "Open in Deezer" button on every TrackCard call into
// this so the backend's listening_history grows with real signal -- not
// just whatever the Modal recommender ships back.

import axios from "axios";

import { API_URL } from "../config";
import { getToken } from "./auth";

const seen = new Set();

function key(profileId, track) {
  const name = track?.name || "";
  const artist = track?.artist || "";
  return `${profileId}::${name}::${artist}`;
}

function entryFor(track) {
  if (!track || !track.name) return null;
  return track.artist ? `${track.name} — ${track.artist}` : track.name;
}

/**
 * POST a single track open to /users/listening_history/:pid.
 *
 * Silent failure on purpose -- this is analytics, not a critical write,
 * and we never want a 401/500 to surface to the user mid-playback. The
 * in-memory `seen` set dedupes within a single page load so spamming the
 * play button doesn't fan out to N writes.
 */
export async function logTrackOpen(profileId, track) {
  if (!profileId) return;
  const token = getToken();
  if (!token) return;
  const entry = entryFor(track);
  if (!entry) return;

  const k = key(profileId, track);
  if (seen.has(k)) return;
  seen.add(k);

  try {
    await axios.post(
      `${API_URL}/users/listening_history/${profileId}/`,
      { track: entry },
      { headers: { Authorization: `Bearer ${token}` } },
    );
  } catch {
    // Allow a retry next render if it failed.
    seen.delete(k);
  }
}
