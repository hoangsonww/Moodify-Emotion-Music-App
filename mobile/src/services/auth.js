// Authentication service: token storage (AsyncStorage), JWT validity
// checks, login/register/refresh, and the global axios interceptors.
//
// Tokens are mirrored in memory so the request interceptor stays
// synchronous; `hydrate()` must run once at app start.

import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

import { API_URL } from '../../config';

const ACCESS_KEY = 'moodify.accessToken';
const REFRESH_KEY = 'moodify.refreshToken';

let accessToken = null;
let refreshToken = null;
let onSessionExpired = null;

/** Load persisted tokens into memory. Call once before rendering the app. */
export async function hydrate() {
  const pairs = await AsyncStorage.multiGet([ACCESS_KEY, REFRESH_KEY]);
  accessToken = pairs[0][1] || null;
  refreshToken = pairs[1][1] || null;
}

/** Register a handler invoked when the session can no longer be refreshed. */
export function setSessionExpiredHandler(handler) {
  onSessionExpired = handler;
}

function isTokenValid(token, skewSeconds = 30) {
  if (!token) return false;
  try {
    const { exp } = jwtDecode(token);
    return typeof exp === 'number' && exp * 1000 - skewSeconds * 1000 > Date.now();
  } catch {
    return false;
  }
}

export function isAuthenticated() {
  return isTokenValid(accessToken);
}

export function getCurrentUser() {
  if (!accessToken) return null;
  try {
    const { sub, username } = jwtDecode(accessToken);
    return { id: sub, username };
  } catch {
    return null;
  }
}

async function persistTokens(access, refresh) {
  accessToken = access || accessToken;
  refreshToken = refresh || refreshToken;
  const pairs = [];
  if (access) pairs.push([ACCESS_KEY, access]);
  if (refresh) pairs.push([REFRESH_KEY, refresh]);
  if (pairs.length) await AsyncStorage.multiSet(pairs);
}

async function clearTokens() {
  accessToken = null;
  refreshToken = null;
  await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY]);
}

export async function login(username, password) {
  const { data } = await axios.post(
    `${API_URL}/users/login/`,
    { username, password },
    { _skipAuth: true },
  );
  await persistTokens(data.access, data.refresh);
}

export async function register(username, email, password) {
  await axios.post(
    `${API_URL}/users/register/`,
    { username, email, password },
    { _skipAuth: true },
  );
}

export async function logout() {
  await clearTokens();
}

let refreshInFlight = null;

function refreshSession() {
  if (!isTokenValid(refreshToken)) return Promise.resolve(false);
  if (!refreshInFlight) {
    refreshInFlight = axios
      .post(`${API_URL}/users/token/refresh/`, { refresh: refreshToken }, { _skipAuth: true })
      .then(async ({ data }) => {
        await persistTokens(data.access, data.refresh);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

function stripContentType(headers) {
  if (!headers) return;
  if (typeof headers.delete === 'function') headers.delete('Content-Type');
  else {
    delete headers['Content-Type'];
    delete headers['content-type'];
  }
}

let interceptorsInstalled = false;

/** Install the request/response interceptors once, at app start. */
export function installInterceptors() {
  if (interceptorsInstalled) return;
  interceptorsInstalled = true;

  axios.interceptors.request.use((config) => {
    if (!config._skipAuth && accessToken) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  });

  axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      const original = error.config || {};
      const status = error.response && error.response.status;

      if (status !== 401 || original._skipAuth || original._retried) {
        return Promise.reject(error);
      }

      original._retried = true;
      const refreshed = await refreshSession();
      if (!refreshed) {
        await clearTokens();
        if (onSessionExpired) onSessionExpired();
        return Promise.reject(error);
      }

      // Drop a stale Content-Type so a retried upload gets a fresh
      // multipart boundary; the request interceptor re-adds the token.
      stripContentType(original.headers);
      return axios(original);
    },
  );
}
