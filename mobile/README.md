# Moodify Mobile

A native **React Native (Expo)** app for Moodify — detect your mood from
text, voice, or a photo and get matching music recommendations.

## Stack

- **Expo SDK 51** / React Native 0.74
- **React Navigation** (native stack)
- **expo-camera** (facial mood) and **expo-av** (voice mood)
- **axios** + JWT auth with silent token refresh
- **AsyncStorage** for token persistence

## Architecture

The app talks to the same two backends as the web frontend:

- **Django API** (`EXPO_PUBLIC_API_URL`) — register, login, token refresh,
  profile and mood/listening history.
- **Modal inference service** (`EXPO_PUBLIC_MODAL_API_URL`) — text, speech
  and facial emotion detection and music recommendations, called directly.

`src/services/auth.js` installs global axios interceptors: every request
carries the JWT, and a `401` triggers one silent refresh + retry.

## Project layout

```
App.js                 navigation + auth-gated stacks
config.js              API base URLs (from EXPO_PUBLIC_* env)
theme.js               dark theme tokens
src/
  context/AuthContext  app-wide auth state
  services/auth.js     token storage, login/register/refresh, interceptors
  services/emotion.js  inference + profile/history API calls
  components/          Screen, AppButton, TextField, TrackCard
  screens/             Login, Register, Home, Results, Profile
```

## Running it

```bash
cd mobile
npm install
cp .env.example .env        # set EXPO_PUBLIC_API_URL / EXPO_PUBLIC_MODAL_API_URL
npm start                   # then press i / a, or scan with Expo Go
```

`config.js` reads those two `EXPO_PUBLIC_*` URLs at build time -- they are
the only deployment-specific values the app needs. For EAS / production
builds, set them as project secrets (`eas env:create EXPO_PUBLIC_API_URL ...`)
or pass them inline (`EXPO_PUBLIC_API_URL=... npx expo start`).

Camera and microphone permissions are requested on first use.

## Screens

- **Login / Register** -- account creation and sign-in.
- **Forgot password** -- two-step reset: verify username + email, then set
  a new password.
- **Home** -- text, voice, or face mood detection.
- **Results** -- mood + recommendations, sortable, market-aware, history
  -personalized; tapping a track logs it to listening history.
- **Profile** -- avatar, stats, recent moods, recent tracks.
- **Settings** -- update email, change password, clear mood / saved
  recommendations / listening history, or delete the account.
