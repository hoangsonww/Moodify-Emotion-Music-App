import axios from "axios";
import { jwtDecode } from "jwt-decode";

import { API_URL } from "../config";

const TOKEN_KEY = "token";
const REFRESH_KEY = "refresh_token";

// Custom event so components (e.g. the navbar) can react to login/logout
// within the same tab -- no polling required.
export const AUTH_EVENT = "moodify:auth-change";

export function notifyAuthChange() {
  window.dispatchEvent(new Event(AUTH_EVENT));
}

// --- Token storage --------------------------------------------------------
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_KEY);

export function setTokens(access, refresh) {
  if (access) localStorage.setItem(TOKEN_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  notifyAuthChange();
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  notifyAuthChange();
}

export function logout() {
  clearTokens();
}

// --- Client-side validity (no network) ------------------------------------
// A JWT carries its own expiry, so validity is checked by decoding it
// locally instead of polling the server. `skewSeconds` treats a token that
// is about to expire as already invalid.
export function isTokenValid(token, skewSeconds = 30) {
  if (!token) return false;
  try {
    const { exp } = jwtDecode(token);
    return typeof exp === "number" && exp * 1000 - skewSeconds * 1000 > Date.now();
  } catch {
    return false;
  }
}

export const isAuthenticated = () => isTokenValid(getToken());

export function getUserClaims() {
  const token = getToken();
  if (!token) return null;
  try {
    return jwtDecode(token);
  } catch {
    return null;
  }
}

// --- Reactive 401 handling (no polling) -----------------------------------
let refreshInFlight = null;

function refreshAccessToken() {
  const refresh = getRefreshToken();
  if (!isTokenValid(refresh)) return Promise.resolve(false);
  // Deduplicate concurrent refreshes triggered by parallel 401s.
  if (!refreshInFlight) {
    refreshInFlight = axios
      .post(
        `${API_URL}/users/token/refresh/`,
        { refresh },
        { _skipAuthRefresh: true },
      )
      .then((res) => {
        setTokens(res.data.access, res.data.refresh);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

let interceptorInstalled = false;

// Install once at app start. On a 401 it attempts a single token refresh
// and replays the request; if the refresh fails the user is logged out.
// This replaces interval-based polling of /users/validate_token/.
export function installAuthInterceptor() {
  if (interceptorInstalled) return;
  interceptorInstalled = true;

  // Attach the bearer token to every outgoing request, so calls to both
  // the Django API and the Modal inference service are authenticated
  // without each call site managing headers.
  axios.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      const original = error.config || {};
      const status = error.response && error.response.status;

      if (status !== 401 || original._skipAuthRefresh || original._authRetried) {
        return Promise.reject(error);
      }

      original._authRetried = true;
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        logout();
        return Promise.reject(error);
      }

      original.headers = {
        ...(original.headers || {}),
        Authorization: `Bearer ${getToken()}`,
      };
      return axios(original);
    },
  );
}

// --- Registration ---------------------------------------------------------
export const register = async (username, password, email) => {
  try {
    await axios.post(`${API_URL}/users/register/`, { username, password, email });
  } catch (error) {
    console.error("Registration error:", error);
  }
};
