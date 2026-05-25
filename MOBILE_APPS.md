# Moodify Mobile — iOS + Android Deep Dive

The definitive reference for the **Moodify React Native app**. Every
screen, every flow, every layer — with side-by-side iOS and Android
captures, two-dozen Mermaid diagrams, end-to-end sequence flows,
component anatomies, performance notes and a complete operations
playbook. Read this top-to-bottom and you can rebuild the app
without opening the source.

<p align="center">
  <img src="images/moodify-logo.png" alt="Moodify" width="160" />
</p>

---

## Table of contents

1. [What it is](#what-it-is)
2. [Screen gallery — iOS + Android side-by-side](#screen-gallery--ios--android-side-by-side)
3. [System architecture](#system-architecture)
   - [Bird's-eye view](#birds-eye-view)
   - [Layered architecture](#layered-architecture)
   - [Module dependency graph](#module-dependency-graph)
   - [Request/response lifecycle](#requestresponse-lifecycle)
4. [Tech stack](#tech-stack)
5. [Project layout](#project-layout)
6. [Boot sequence](#boot-sequence)
7. [Navigation map](#navigation-map)
8. [Authentication — flows + diagrams](#authentication--flows--diagrams)
9. [Mood inference pipeline](#mood-inference-pipeline)
10. [Music recommendation pipeline](#music-recommendation-pipeline)
11. [Screen-by-screen tour](#screen-by-screen-tour)
12. [Component anatomy](#component-anatomy)
13. [Theme system](#theme-system)
14. [Networking + API layer](#networking--api-layer)
15. [State management](#state-management)
16. [Animation cookbook](#animation-cookbook)
17. [Haptics matrix](#haptics-matrix)
18. [Toast system](#toast-system)
19. [Permissions](#permissions)
20. [Data model](#data-model)
21. [Security model](#security-model)
22. [Performance notes](#performance-notes)
23. [Accessibility](#accessibility)
24. [Platform differences (iOS vs Android)](#platform-differences-ios-vs-android)
25. [Building, running, shipping](#building-running-shipping)
26. [Testing on simulator + device](#testing-on-simulator--device)
27. [Capturing screenshots](#capturing-screenshots)
28. [Operations playbook](#operations-playbook)
29. [Troubleshooting](#troubleshooting)
30. [Roadmap](#roadmap)
31. [Appendix — file index](#appendix--file-index)

---

## What it is

Moodify Mobile is a cross-platform **React Native (Expo SDK 51)** client
for the Moodify emotion-to-music recommendation service. From a **single
JS codebase** it ships native binaries to both stores and provides:

- 🔐 **JWT-backed auth** with silent refresh, multi-step password reset.
- 🎙️ **Three inference modalities** — typed text, recorded `.m4a`,
  front-facing `.jpg` selfie — each one routed through the **Modal**
  inference service.
- 🎧 **Mood-aware recommendations** — 13-mood palette, four sort orders,
  17 market filters, history-personalized blend, Deezer deep link.
- 📜 **Per-user history** — mood log, listening log, saved
  recommendations, all reversible from Settings.
- ⚙️ **Account management** — change email, change password, clear
  history (granularly), permanently delete account.

Two URLs configure everything:

| Service                     | Purpose                                                           |
| --------------------------- | ----------------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL`       | Django REST API — auth, profile, history                          |
| `EXPO_PUBLIC_MODAL_API_URL` | Modal inference service — emotion models + music recommender      |

Both are stripped of trailing slashes at boot and have **production
fallbacks baked into [`config.js`](mobile/config.js)**, so an empty `.env`
still produces a working build that talks to the live Moodify backends.

---

## Screen gallery — iOS + Android side-by-side

The app has **14 distinct screen states**. Every one was captured on
**iPhone 16 Pro (iOS 18.5)** and a **Pixel-class Android emulator** so
you can compare platform-native rendering, blur layers, status bars and
the custom pill-shaped tab bar across both OSes.

| # | Screen | iOS | Android |
|---|---|---|---|
| 01 | Login | <img src="mobile/docs/screenshots/ios/01-login.png" width="260" /> | <img src="mobile/docs/screenshots/android/01-login.png" width="260" /> |
| 02 | Home — Text mode | <img src="mobile/docs/screenshots/ios/02-home-text.png" width="260" /> | <img src="mobile/docs/screenshots/android/02-home-text.png" width="260" /> |
| 03 | Home — Voice mode | <img src="mobile/docs/screenshots/ios/03-home-voice.png" width="260" /> | <img src="mobile/docs/screenshots/android/03-home-voice.png" width="260" /> |
| 04 | Home — Face mode | <img src="mobile/docs/screenshots/ios/04-home-face.png" width="260" /> | <img src="mobile/docs/screenshots/android/04-home-face.png" width="260" /> |
| 05 | Results | <img src="mobile/docs/screenshots/ios/05-results.png" width="260" /> | <img src="mobile/docs/screenshots/android/05-results.png" width="260" /> |
| 06 | Sort sheet | <img src="mobile/docs/screenshots/ios/06-sort-sheet.png" width="260" /> | <img src="mobile/docs/screenshots/android/06-sort-sheet.png" width="260" /> |
| 07 | Market sheet | <img src="mobile/docs/screenshots/ios/07-market-sheet.png" width="260" /> | <img src="mobile/docs/screenshots/android/07-market-sheet.png" width="260" /> |
| 08 | Profile | <img src="mobile/docs/screenshots/ios/08-profile.png" width="260" /> | <img src="mobile/docs/screenshots/android/08-profile.png" width="260" /> |
| 09 | Settings | <img src="mobile/docs/screenshots/ios/09-settings.png" width="260" /> | <img src="mobile/docs/screenshots/android/09-settings.png" width="260" /> |
| 10 | Edit-email modal | <img src="mobile/docs/screenshots/ios/10-edit-email.png" width="260" /> | <img src="mobile/docs/screenshots/android/10-edit-email.png" width="260" /> |
| 11 | Change-password modal | <img src="mobile/docs/screenshots/ios/11-change-password.png" width="260" /> | <img src="mobile/docs/screenshots/android/11-change-password.png" width="260" /> |
| 12 | Register | <img src="mobile/docs/screenshots/ios/12-register.png" width="260" /> | <img src="mobile/docs/screenshots/android/12-register.png" width="260" /> |
| 13 | Forgot password — verify | <img src="mobile/docs/screenshots/ios/13-forgot-verify.png" width="260" /> | <img src="mobile/docs/screenshots/android/13-forgot-verify.png" width="260" /> |
| 14 | Forgot password — reset | <img src="mobile/docs/screenshots/ios/14-forgot-reset.png" width="260" /> | <img src="mobile/docs/screenshots/android/14-forgot-reset.png" width="260" /> |
| 15 | Explore — Results + RL feedback widget + 👍/👎 | <img src="mobile/docs/screenshots/ios/15-explore.png" width="260" /> | <img src="mobile/docs/screenshots/android/15-explore.png" width="260" /> |

---

## System architecture

### Bird's-eye view

```mermaid
flowchart LR
    subgraph Device["📱 User device (iOS / Android)"]
        UI[React Native UI]
        Ctx[Auth Context]
        Cam[expo-camera]
        Mic[expo-av]
        Hap[expo-haptics]
        Loc[expo-localization]
        Store[(AsyncStorage<br/>JWT tokens)]
    end

    subgraph Net["Network layer"]
        Ax[Axios + interceptors<br/>silent refresh on 401]
    end

    subgraph Backend["Backends"]
        Django[Django REST API<br/>EXPO_PUBLIC_API_URL]
        Modal[Modal inference<br/>EXPO_PUBLIC_MODAL_API_URL]
    end

    subgraph External["Third-party"]
        Deezer[(Deezer search<br/>open in browser)]
    end

    UI -- "auth, profile, history" --> Ctx --> Ax --> Django
    UI -- "text / audio / image" --> Ax --> Modal
    Modal -- "Deezer search URLs" --> UI
    UI -- "Linking.openURL" --> Deezer
    Ctx <-->|persist/hydrate| Store
    Cam -- "photo URI" --> UI
    Mic -- "recording URI" --> UI
    Hap -- "tap/select/success/error" --> UI
    Loc -- "regionCode" --> UI
```

### Layered architecture

```mermaid
flowchart TB
    A[App.js<br/>Stack + Tab navigators<br/>Auth-gated routing] --> B[Screens layer]
    B -->|hooks| C[Context layer<br/>AuthContext + Toast]
    B -->|UI primitives| D[Components layer<br/>13 reusable components]
    B -->|API| E[Services layer<br/>auth.js + emotion.js]
    E -->|axios| F[Django REST API]
    E -->|axios FormData| G[Modal Inference]
    D -->|tokens| H[Theme layer<br/>theme.js — colors, gradient, moodPalette, radius, spacing, typography, shadows, motion]
    C -->|AsyncStorage| I[(Token store)]
    B -->|haptics, localization, audio, camera| J[Expo SDK plugins]
```

### Module dependency graph

```mermaid
flowchart LR
    AppJs[App.js] --> NavTab[TabNavigator]
    AppJs --> AuthCtx[AuthContext]
    AppJs --> Toast[ToastProvider]
    AppJs --> ScreenStack[Stack of screens]

    AuthCtx --> AuthSvc[services/auth.js]
    AuthSvc --> AS[(AsyncStorage)]
    AuthSvc --> JWTd[jwt-decode]
    AuthSvc --> Ax1[axios]

    ScreenStack --> Login & Register & Forgot
    ScreenStack --> Tabs[TabNavigator host]
    Tabs --> Home & Profile & Settings
    Home --> EmotionSvc[services/emotion.js]
    Results --> EmotionSvc
    Profile --> EmotionSvc
    Settings --> EmotionSvc & AuthCtx

    Home --> FaceCap[components/FaceCapture]
    Home --> ExpoAv[expo-av Audio]
    FaceCap --> ExpoCam[expo-camera]

    style AppJs fill:#8b5cf6,color:#fff
    style AuthCtx fill:#ec4899,color:#fff
    style EmotionSvc fill:#34d399,color:#000
```

### Request/response lifecycle

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant S as Screen
    participant A as AuthContext
    participant X as Axios
    participant API as Django API
    participant M as Modal Inference

    U->>S: Tap "Analyze my mood"
    S->>X: POST /text_emotion {text}
    X->>M: Bearer-less call (Modal is public)
    M-->>X: { emotion, recommendations }
    X-->>S: data
    S->>X: POST /users/mood_history/:pid
    X->>X: request interceptor adds JWT
    X->>API: with Authorization: Bearer …
    API-->>X: 200 OK
    X-->>S: ack
    S->>S: navigate('Results', {…})
```

---

## Tech stack

| Layer                         | Choice                                                                       |
| ----------------------------- | ---------------------------------------------------------------------------- |
| Runtime                       | **Expo SDK 51**, React Native **0.74.5**, React **18.2**                     |
| Navigation                    | `@react-navigation/native-stack` + `@react-navigation/bottom-tabs`           |
| UI primitives                 | `expo-blur`, `expo-linear-gradient`, `@expo/vector-icons` (Ionicons)         |
| Animation                     | RN `Animated` API + `Easing` + spring physics                                |
| Storage                       | `@react-native-async-storage/async-storage`                                  |
| Auth                          | `jwt-decode` v4 + custom axios interceptors                                  |
| HTTP                          | `axios` 1.7 — silent JWT refresh, `_skipAuth` opt-out, `_retried` guard      |
| Camera                        | `expo-camera` (front-facing) for facial mood                                 |
| Audio                         | `expo-av` recording API for voice mood                                       |
| Haptics                       | `expo-haptics` (tap-light / tap-medium / select / success / error)           |
| Localization                  | `expo-localization` (auto-detected market)                                   |
| Fonts                         | `expo-font` (system + Ionicons)                                              |
| Build                         | `npx expo start` (dev) / EAS Build + EAS Update (prod)                       |
| Lint style                    | Expo + React Native community convention (no project-level eslintrc yet)     |
| Tests                         | None checked in (manual QA on simulators + Expo Go)                          |

Full manifest in [`mobile/package.json`](mobile/package.json).

---

## Project layout

```
mobile/
├── App.js                         # root navigator, auth-gated stacks
├── app.json                       # Expo manifest (bundle ids, plugins, icons)
├── config.js                      # API_URL / MODAL_API_URL resolver
├── theme.js                       # design tokens (color, gradient, mood, type)
├── babel.config.js                # Expo babel preset
├── package.json                   # deps & expo scripts
├── assets/                        # icon, splash, adaptive icon
├── components/                    # (top-level placeholder, currently empty)
├── docs/
│   └── screenshots/
│       ├── ios/                   # 14 captures (iPhone 16 Pro, iOS 18.5)
│       └── android/               # 14 captures (Pixel-class emulator)
└── src/
    ├── context/
    │   └── AuthContext.js         # AuthProvider + useAuth() hook
    ├── services/
    │   ├── auth.js                # token store, login/register/refresh, interceptors
    │   └── emotion.js             # text/speech/face inference + history endpoints
    ├── navigation/
    │   └── TabNavigator.js        # custom blurred pill tab bar
    ├── screens/
    │   ├── LoginScreen.js
    │   ├── RegisterScreen.js
    │   ├── ForgotPasswordScreen.js  # 2-step verify → reset
    │   ├── HomeScreen.js            # text / voice / face mode switcher
    │   ├── ResultsScreen.js         # tracks + sort + market sheets
    │   ├── ProfileScreen.js         # avatar, stats, recent moods + tracks
    │   └── SettingsScreen.js        # account + data + danger zone
    ├── components/
    │   ├── Screen.js              # safe-area wrapper + mood-tinted bg
    │   ├── AppButton.js           # primary / ghost / danger variants
    │   ├── TextField.js           # labeled input with leading icon
    │   ├── GradientBorder.js      # 1.5px gradient hairline frame
    │   ├── MoodHero.js            # animated mood card on Results
    │   ├── TrackCard.js           # track row + play button
    │   ├── OptionSheet.js         # bottom-sheet picker (sort / market)
    │   ├── FaceCapture.js         # camera permission + capture flow
    │   ├── StatCard.js            # 3-up stat tile on Profile
    │   ├── SectionHeader.js       # title + subtitle pair
    │   ├── Skeleton.js            # shimmer rows while loading tracks
    │   ├── EmptyState.js          # "no tracks / no moods" placeholder
    │   └── Toast.js               # ToastProvider + useToast hook
    └── util/
        └── haptics.js             # platform-safe haptic wrappers
```

---

## Boot sequence

```mermaid
sequenceDiagram
    autonumber
    participant N as Native shell (iOS/Android)
    participant J as JS bundle
    participant A as App.js
    participant T as ToastProvider
    participant AC as AuthProvider
    participant S as services/auth.js
    participant AS as AsyncStorage
    participant Nav as NavigationContainer

    N->>J: load JS bundle (Hermes)
    J->>A: mount App
    A->>T: render ToastProvider
    T->>AC: render AuthProvider
    AC->>AC: status = 'loading'
    AC->>S: installInterceptors()
    AC->>S: setSessionExpiredHandler()
    AC->>S: hydrate()
    S->>AS: multiGet([access, refresh])
    AS-->>S: tokens
    S-->>AC: ok
    AC->>S: isAuthenticated()
    S-->>AC: bool
    AC->>AC: status = signedIn | signedOut
    AC->>Nav: render RootNavigator with correct stack
```

The app shows a centered `<ActivityIndicator>` on `colors.bg` while
`status === 'loading'`; once `hydrate()` resolves the navigator
immediately swaps to either the auth stack or the tab navigator —
there's no intermediate landing screen.

---

## Navigation map

```mermaid
flowchart TD
    Root((Root Native Stack)) -->|status=signedOut| L[Login]
    Root -->|status=signedIn| Tabs

    L --> R[Register]
    L --> FP1[Forgot Password — Verify]
    FP1 --> FP2[Forgot Password — Reset]
    R --> L
    FP2 --> L

    subgraph Tabs[Bottom Tab Navigator]
        H[Home]
        P[Profile]
        S[Settings]
    end

    Tabs --> RES[Results]
    P --> RES
    H --> RES
    RES --> Tabs

    S -->|modal| EM[Edit Email]
    S -->|modal| CP[Change Password]
    S -->|destructive| DEL[Delete Account]
    S -->|signOut| Root

    style Root fill:#8b5cf6,stroke:#fff,color:#fff
    style Tabs fill:#1a1a25,stroke:#8b5cf6,color:#f6f6f8
```

The custom tab bar in
[`mobile/src/navigation/TabNavigator.js`](mobile/src/navigation/TabNavigator.js)
is a `BlurView`-backed pill that floats above the content with a
gradient-filled active pill and outline icons for inactive tabs:

```mermaid
flowchart LR
    subgraph TB["floating pill tab bar (absolute, bottom = max(safe-inset, 8))"]
        direction LR
        T1[✨ Home<br/>gradient pill] --- T2[👤 Profile<br/>outline] --- T3[⚙ Settings<br/>outline]
    end
```

### Route → header config map

| Route               | Header              | Special                                                                |
| ------------------- | ------------------- | ---------------------------------------------------------------------- |
| `Login`             | `headerShown:false` | full-bleed orbs + animated halo                                        |
| `Register`          | transparent + title `''` | back button styled by `navTheme`                                  |
| `ForgotPassword`    | transparent + title `''` | progress-rail animates between two steps in one screen            |
| `Tabs`              | hidden              | custom `<CustomTabBar>` overrides default                              |
| `Results`           | transparent + title `''` | mood-tinted background via `<Screen moodTint={palette}>`          |

---

## Authentication — flows + diagrams

### Token lifecycle

```mermaid
stateDiagram-v2
    [*] --> loading
    loading --> signedOut: tokens missing / expired
    loading --> signedIn: access token still valid

    signedOut --> signedIn: login() / register()+signIn()
    signedIn --> signedOut: signOut() / changePassword() / deleteAccount() / refresh fails

    signedIn --> signedIn: silent refresh on 401
```

### Sign-in sequence

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant L as LoginScreen
    participant A as AuthContext
    participant S as services/auth.js
    participant DB as Django API
    participant ST as AsyncStorage

    U->>L: type username + password, tap Sign in
    L->>A: signIn(u,p)
    A->>S: login(u,p) (POST /users/login/ with _skipAuth)
    S->>DB: POST /users/login/
    DB-->>S: { access, refresh }
    S->>ST: multiSet(access, refresh)
    S-->>A: ok
    A->>A: status = 'signedIn'
    A-->>L: re-render
    Note over L: Root stack swaps to Tabs
```

### Register-then-auto-sign-in

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant R as RegisterScreen
    participant A as AuthContext
    participant DB as Django API

    U->>R: fill all 4 fields, tap Create
    R->>R: client validation (length, match)
    R->>A: register(u, e, p)
    A->>DB: POST /users/register/ (_skipAuth)
    DB-->>A: 201
    A->>A: signIn(u, p)
    A->>DB: POST /users/login/ (_skipAuth)
    DB-->>A: { access, refresh }
    A->>A: status = signedIn
    Note over R: bounce to Home
```

### Silent refresh on 401

```mermaid
sequenceDiagram
    autonumber
    participant R as Any screen
    participant X as Axios
    participant DB as Django API
    participant S as services/auth.js
    participant ST as AsyncStorage

    R->>X: GET /users/user/profile/
    X->>DB: with stale Bearer
    DB-->>X: 401 Unauthorized

    X->>S: refreshSession()
    alt refresh token still valid
        S->>DB: POST /users/token/refresh/
        DB-->>S: { access, refresh }
        S->>ST: persistTokens()
        X->>X: strip Content-Type, replay original
        X->>DB: retry with new Bearer
        DB-->>X: 200 OK
        X-->>R: data
    else refresh token invalid
        S->>ST: multiRemove tokens
        S-->>X: false
        X->>X: invoke onSessionExpired()
        X-->>R: reject
        Note over R: Root stack swaps back to Login
    end
```

A single in-flight refresh promise is reused via `refreshInFlight`, so
a burst of concurrent 401s only triggers **one** token-refresh
round-trip.

### Two-step password reset

```mermaid
flowchart LR
    A[Step 1 — Verify] -->|POST /users/verify-username-email/| OK1{200?}
    OK1 -- yes --> B[Step 2 — Reset]
    OK1 -- no --> A
    B -->|POST /users/reset-password/| OK2{200?}
    OK2 -- yes --> L[Login]
    OK2 -- no --> B
```

The two steps share a single screen with an animated **progress rail**
between the dots; the hero icon and gradient swap from violet/indigo
(verify) to cyan/lime (reset) when step 2 is reached.

| | iOS | Android |
|---|---|---|
| Step 1 — Verify | <img src="mobile/docs/screenshots/ios/13-forgot-verify.png" width="240" /> | <img src="mobile/docs/screenshots/android/13-forgot-verify.png" width="240" /> |
| Step 2 — Reset  | <img src="mobile/docs/screenshots/ios/14-forgot-reset.png" width="240" /> | <img src="mobile/docs/screenshots/android/14-forgot-reset.png" width="240" /> |

### JWT decode + validity

```mermaid
flowchart LR
    T[Stored JWT] --> J[jwt-decode]
    J --> Exp[exp claim]
    J --> Sub[sub / username claims]
    Exp --> V{exp*1000 - 30000 > Date.now?}
    V -- yes --> OK[token valid]
    V -- no  --> Bad[token expired]
    Sub --> Profile["getCurrentUser returns id + username"]
```

A 30-second `skewSeconds` tolerance guards against minor device-clock
drift; if the device is more than 30 seconds ahead of UTC the token
will appear pre-expired and the user gets bounced.

---

## Mood inference pipeline

```mermaid
flowchart TB
    subgraph Inputs["📥 User input"]
        TI[Text<br/>multiline TextField]
        VI[Voice<br/>expo-av Audio.Recording HIGH_QUALITY]
        FI[Face<br/>expo-camera front-facing, quality=0.6]
    end

    subgraph Client["Client preprocessing"]
        TI --> RT[trim]
        VI --> RU[file URI of m4a]
        FI --> PU[file URI of jpg]
    end

    subgraph Network["services/emotion.js"]
        RT --> EP1[analyzeText - POST /text_emotion]
        RU --> EP2[analyzeSpeech - POST /speech_emotion FormData]
        PU --> EP3[analyzeFace - POST /facial_emotion FormData]
    end

    EP1 --> M[Modal inference service]
    EP2 --> M
    EP3 --> M

    M -->|emotion + recommendations| Res[ResultsScreen]
    M -.timeout / network error.-> FB[FALLBACK_TRACKS<br/>degraded=true]
    FB --> Res
```

Key resilience properties:

- **Inference calls NEVER throw.** Any axios failure resolves into a
  `degraded: true` result with curated `FALLBACK_TRACKS`. The Results
  screen surfaces this via a subtle "we weren't fully certain" tagline
  on the mood hero card.
- **60 s timeout** on every inference call to absorb Modal cold starts.
- **Best-effort persistence.** After a successful inference the screen
  fires-and-forgets `saveMood` and `saveRecommendations` against the
  Django API; if those fail the user still sees their tracks.

### Voice mode — full sequence

```mermaid
sequenceDiagram
    participant U as User
    participant H as HomeScreen
    participant Mic as expo-av
    participant Modal as Modal API
    participant Res as ResultsScreen

    U->>H: tap mic
    H->>Mic: requestPermissionsAsync()
    Mic-->>H: granted
    H->>Mic: setAudioModeAsync({allowsRecordingIOS:true})
    H->>Mic: Recording.createAsync(HIGH_QUALITY)
    Note over H: pulse ring animation loops while recording
    U->>H: tap stop
    H->>Mic: stopAndUnloadAsync()
    H->>Mic: setAudioModeAsync({allowsRecordingIOS:false})
    Mic-->>H: file:// URI (.m4a)
    H->>Modal: POST /speech_emotion (multipart)
    Modal-->>H: {emotion, recommendations}
    H->>Res: navigate(Results,…)
```

### Face mode — full sequence

```mermaid
sequenceDiagram
    participant U as User
    participant FC as FaceCapture
    participant Cam as expo-camera
    participant Modal as Modal API

    U->>FC: tap "Grant camera access"
    FC->>Cam: requestPermission()
    Cam-->>FC: granted
    FC->>Cam: takePictureAsync({quality:0.6, skipProcessing:true})
    Cam-->>FC: photo URI
    FC->>Modal: POST /facial_emotion (multipart)
    Modal-->>FC: {emotion, recommendations}
```

The camera preview displays a centered circular framing guide via a
50%-opacity white ring overlay so the user knows where to align their
face.

### Text mode — full sequence

```mermaid
sequenceDiagram
    participant U as User
    participant H as HomeScreen
    participant Modal as Modal API

    U->>H: type a few words, tap Analyze
    H->>H: setBusy(true) + overlay spinner
    H->>Modal: POST /text_emotion {text}
    Modal-->>H: {emotion, recommendations}
    H->>H: setBusy(false)
    H->>H: saveMood + saveRecommendations (fire-and-forget)
    H->>Res: navigate(Results, {emotion, recommendations, history, profileId})
```

---

## Music recommendation pipeline

```mermaid
flowchart LR
    E[emotion] --> P[POST /music_recommendation]
    M[market<br/>optional] --> P
    H[history slice -50] --> P
    P --> Modal[Modal Inference]
    Modal --> R[recommendations]
    R --> Sort{sortKey}
    Sort -->|recommended| Out[as-is]
    Sort -->|popular| OutP[by popularity desc]
    Sort -->|title| OutT[A→Z by name]
    Sort -->|artist| OutA[A→Z by artist]
    Out --> UI[ResultsScreen FlatList]
    OutP --> UI
    OutT --> UI
    OutA --> UI
    UI -->|tap a row| Deezer[Linking.openURL Deezer search]
    UI -->|tap row| Save[POST /users/listening_history/:pid]
```

### Pagination + shuffle

```mermaid
stateDiagram-v2
    [*] --> Initial: tracks=recommendations, visible=PAGE
    Initial --> Sorted: sortTracks(tracks, sortKey)
    Sorted --> Shown: slice(0, visible)
    Shown --> Shown: onEndReached → visible+=PAGE
    Shown --> Refetched: shuffle / market change → loadFor(market)
    Refetched --> Sorted
```

The market dropdown ships with 16 ISO-3166 codes plus a "Global" option;
the initial value is **auto-detected from `expo-localization`**, falling
back to Global if the device's region isn't in the supported list.

Pagination is client-side via a `visible` counter (PAGE = 12) and
`onEndReached`; the underlying list is fully fetched up-front.

### Sort modes — exact comparators

| Sort key      | Comparator                                                                |
| ------------- | ------------------------------------------------------------------------- |
| `recommended` | identity (preserve server order)                                          |
| `popular`     | `(b.popularity \|\| 0) - (a.popularity \|\| 0)`                            |
| `title`       | `String(a.name \|\| '').localeCompare(String(b.name \|\| ''))`             |
| `artist`      | `String(a.artist \|\| '').localeCompare(String(b.artist \|\| ''))`         |

---

## Screen-by-screen tour

Every screen below shows the **iOS** capture on the left and the
**Android** capture on the right. State-bearing controls and what
triggers them are documented next to each one.

### 01 — Login

| iOS | Android |
|---|---|
| <img src="mobile/docs/screenshots/ios/01-login.png" width="290" /> | <img src="mobile/docs/screenshots/android/01-login.png" width="290" /> |

- Three radial **orbs** (violet + magenta) animate in opposite directions
  in the background; the violet **halo** behind the logo pulses very
  subtly (max opacity ~0.22, scale jitter 0.96 → 1.06).
- The hero shows a 84 × 84 rounded gradient tile with the `musical-notes`
  icon, the `MOODIFY` kicker, the `Welcome back` H1 and a tri-feature row
  (Voice · Face · Text) of soft-tinted chips.
- The card itself is wrapped in a 1.5 px gradient hairline
  (`GradientBorder`) — the same hairline you'll see on Register and
  Forgot password.
- Tapping **Forgot password?** pushes `ForgotPasswordScreen`; tapping
  **Create an account** pushes `RegisterScreen`.

### 02 — Home, Text mode

| iOS | Android |
|---|---|
| <img src="mobile/docs/screenshots/ios/02-home-text.png" width="290" /> | <img src="mobile/docs/screenshots/android/02-home-text.png" width="290" /> |

- Time-aware greeting: `Late night / Good morning / Good afternoon /
  Good evening / Good night` based on the device clock.
- **Last-mood chip** at the top: tinted with the corresponding
  `moodPalette` gradient, tapping it re-opens Results for that emotion
  with a fresh recommendation fetch.
- Mode selector renders three full-width cards — the active one gets a
  gradient icon + check mark + accent border.
- Multiline `TextField` for the day's blurb; **Analyze my mood**
  CTA fires `analyzeText()` and pushes Results.
- A horizontal "Recent moods" strip appears at the bottom once the
  history has at least one entry.

### 03 — Home, Voice mode

| iOS | Android |
|---|---|
| <img src="mobile/docs/screenshots/ios/03-home-voice.png" width="290" /> | <img src="mobile/docs/screenshots/android/03-home-voice.png" width="290" /> |

- Idle state shows the 132 px gradient mic button glowing on
  `shadows.glow`; the recording state swaps it for a red disk with a
  white stop glyph, surrounded by an outwards-easing **pulse ring**.
- Microphone permission is requested on first tap and skipped on
  subsequent uses. If the user denies it, a toast (`Microphone needed`)
  is shown and no recording starts.

### 04 — Home, Face mode

| iOS | Android |
|---|---|
| <img src="mobile/docs/screenshots/ios/04-home-face.png" width="290" /> | <img src="mobile/docs/screenshots/android/04-home-face.png" width="290" /> |

- If camera permission is undecided or denied, the empty state
  (camera icon, title, hint, ghost "Grant camera access" button) is
  shown — uploads only happen after capture, never before.
- Once granted, the embedded `<CameraView facing="front">` renders inside
  a 3 : 4 rounded card with a circular alignment ring; `Capture & analyze`
  triggers `takePictureAsync({quality:0.6, skipProcessing:true})` and
  ships the JPG to Modal.

### 05 — Results

| iOS | Android |
|---|---|
| <img src="mobile/docs/screenshots/ios/05-results.png" width="290" /> | <img src="mobile/docs/screenshots/android/05-results.png" width="290" /> |

- **`MoodHero`** card renders a per-mood gradient + emoji + label. If the
  inference fell back, it shows `We weren't fully certain — here's our
  best guess.` instead of the normal subtitle.
- Two control pills below the hero (`Recommended` sort + `United States`
  market) open bottom-sheet pickers.
- The list itself is a `FlatList` of `TrackCard`s with a popularity flame
  badge, paginated client-side (PAGE = 12). When the popular sort is
  active, a rank number is rendered on the leading edge.
- Bottom buttons: **Shuffle recommendations** (ghost) and **Analyze
  another mood** (primary, navigates back to Home).

### 06 — Sort sheet

| iOS | Android |
|---|---|
| <img src="mobile/docs/screenshots/ios/06-sort-sheet.png" width="290" /> | <img src="mobile/docs/screenshots/android/06-sort-sheet.png" width="290" /> |

- `OptionSheet` is a `Modal` with `animationType="slide"` over a tinted
  scrim. Each row is `[ icon ] [ label ] [ ✓ ]`.
- Available sort modes: **Recommended · Most popular · Title (A–Z) ·
  Artist (A–Z)**.

### 07 — Market sheet

| iOS | Android |
|---|---|
| <img src="mobile/docs/screenshots/ios/07-market-sheet.png" width="290" /> | <img src="mobile/docs/screenshots/android/07-market-sheet.png" width="290" /> |

- 17 market options (Global + 16 country codes). Selecting one re-fetches
  the recommendation list with `loadFor(key)`.
- The initial selection is taken from the device locale via
  `expo-localization` if the detected region is supported, otherwise
  Global.

### 08 — Profile

| iOS | Android |
|---|---|
| <img src="mobile/docs/screenshots/ios/08-profile.png" width="290" /> | <img src="mobile/docs/screenshots/android/08-profile.png" width="290" /> |

- Hero card: 96 × 96 gradient avatar ring (initial of username), the
  username, the email, and a ghost "Settings" button.
- Three `StatCard`s in a row: **Moods logged · Saved tracks · Listened**.
- "Recent moods" — last 15 moods reversed; each chip uses the
  corresponding mood palette as an 18%-opacity background tint. Tapping
  a chip re-opens Results for that mood with the same `history` payload.
- "Recent tracks" — last 15 listening entries. Tapping a row opens a
  Deezer search for the track + artist in the system browser.
- Pull to refresh (`<RefreshControl tintColor=primary>`) reloads the
  profile from `getProfile()`.

### 09 — Settings

| iOS | Android |
|---|---|
| <img src="mobile/docs/screenshots/ios/09-settings.png" width="290" /> | <img src="mobile/docs/screenshots/android/09-settings.png" width="290" /> |

Three logical groups:

| Group         | Rows                                                                                     |
| ------------- | ---------------------------------------------------------------------------------------- |
| Account       | Email · Password                                                                         |
| Your data     | Clear mood history · Clear saved recommendations · Clear listening history               |
| Danger zone   | Delete account (red) · Log out (ghost)                                                   |

All destructive actions go through `Alert.alert` with a destructive
button + cancel option before firing.

### 10 — Edit-email modal

| iOS | Android |
|---|---|
| <img src="mobile/docs/screenshots/ios/10-edit-email.png" width="290" /> | <img src="mobile/docs/screenshots/android/10-edit-email.png" width="290" /> |

- A bottom sheet rendered from `<Modal animationType="slide">` with a
  blurred backdrop (`<BlurView intensity={30}>`).
- The sheet pre-populates with the current email; pressing Save fires
  `updateProfile({ email })` against the Django API and refreshes the
  profile in-place.

### 11 — Change-password modal

| iOS | Android |
|---|---|
| <img src="mobile/docs/screenshots/ios/11-change-password.png" width="290" /> | <img src="mobile/docs/screenshots/android/11-change-password.png" width="290" /> |

- Two `TextField`s (new + confirm); minimum 8 chars; both fields must
  match.
- Calls `changePassword(newPassword)` which uses the existing
  reset-password endpoint with the current JWT's `username` claim and
  **clears the local tokens** on success — the user is bounced back to
  Login.

### 12 — Register

| iOS | Android |
|---|---|
| <img src="mobile/docs/screenshots/ios/12-register.png" width="290" /> | <img src="mobile/docs/screenshots/android/12-register.png" width="290" /> |

- Gradient palette intentionally swapped to `pink → purple → violet` to
  visually distinguish it from Login.
- Two sub-cards inside the gradient frame: **Your identity** (username +
  email) and **Secure your account** (password + confirm).
- A live **password strength** meter (4 segments, color shifts
  red→amber→green) and four rule chips (`8+ chars`, `Aa`, `0-9`, `!@#`)
  that turn green as they are satisfied.
- After successful register the screen auto-calls `signIn()` so the user
  lands directly on Home.

### 13 — Forgot password, Step 1 (Verify)

| iOS | Android |
|---|---|
| <img src="mobile/docs/screenshots/ios/13-forgot-verify.png" width="290" /> | <img src="mobile/docs/screenshots/android/13-forgot-verify.png" width="290" /> |

- Hero icon: `shield-checkmark`. Gradient: violet → indigo → blue.
- A progress rail animates between the two step dots; the dot for the
  current step is filled with the hero gradient.
- Endpoint: `POST /users/verify-username-email/`. 404 yields the toast
  "Couldn't find that username and email combination."

### 14 — Forgot password, Step 2 (Reset)

| iOS | Android |
|---|---|
| <img src="mobile/docs/screenshots/ios/14-forgot-reset.png" width="290" /> | <img src="mobile/docs/screenshots/android/14-forgot-reset.png" width="290" /> |

- Hero icon: `key`. Gradient: cyan → emerald → lime.
- A green `Verified <username>` badge pins the verified identity so the
  user can't reset against the wrong account from this step.
- Endpoint: `POST /users/reset-password/`. On success a success toast
  fires and the user is bounced back to Login.

---

## Component anatomy

| Component        | Role                                            | Key props                                   |
| ---------------- | ----------------------------------------------- | ------------------------------------------- |
| `Screen`         | safe-area + mood-tinted scroll container        | `padded`, `moodTint`                        |
| `AppButton`      | primary / ghost / danger variants               | `title`, `icon`, `variant`, `loading`, `size` |
| `TextField`      | labeled input with optional leading icon        | `label`, `leftIcon`, `iconTint`, `secureTextEntry`, `multiline` |
| `GradientBorder` | 1.5 px gradient frame around any card           | `colors`, `borderWidth`                     |
| `MoodHero`       | mood card on Results — gradient + emoji + label | `emotion`, `degraded`                       |
| `TrackCard`      | track row — art, name, artist, popularity, play | `track`, `onPlay`, `rank`                   |
| `OptionSheet`    | bottom-sheet single-select                      | `visible`, `title`, `options`, `selectedKey`, `onSelect`, `onClose` |
| `FaceCapture`    | camera permission + preview + capture           | `onCapture`, `onError`                      |
| `StatCard`       | tile for Profile stats                          | `icon`, `label`, `value`, `tint`, `tintSoft` |
| `SectionHeader`  | title + subtitle pair                           | `title`, `subtitle`                         |
| `Skeleton`       | shimmer placeholder row                         | none                                        |
| `EmptyState`     | icon + title + message + optional CTA           | `icon`, `title`, `message`, `actionLabel`, `onAction` |
| `Toast`          | one-shot transient notifications                | provider + `useToast()` hook                |

### AppButton variant matrix

```mermaid
flowchart LR
    A[AppButton] --> P[primary<br/>gradient + glow]
    A --> G[ghost<br/>outline]
    A --> D[danger<br/>red fill]
    A --> Loading{loading?}
    Loading -- yes --> Spin[<ActivityIndicator/>]
    Loading -- no  --> Label[icon + title]
```

### OptionSheet anatomy

```mermaid
sequenceDiagram
    participant H as Host screen
    participant O as OptionSheet (Modal)
    participant U as User

    H->>O: <OptionSheet visible options selectedKey/>
    O->>U: slide up over scrim
    U->>O: tap row
    O->>O: onSelect(key)
    O->>H: onClose()
    H->>H: state updates → re-render list
```

---

## Theme system

`theme.js` exports five token namespaces — every screen and component
sources from them rather than hard-coding values.

```mermaid
flowchart LR
    T["theme.js"] --> C["colors\nbg / surfaces / text / brand / state"]
    T --> G["gradient\nviolet → fuchsia → pink"]
    T --> M["moodPalette\n13 per-mood gradients"]
    T --> SP["spacing\nxs sm md lg xl xxl"]
    T --> R["radius\nxs sm md lg xl pill"]
    T --> TY["typography\ndisplay h1 h2 h3 body bodyStrong caption micro"]
    T --> SH["shadows\nsm md glow"]
    T --> MO["motion\nfast base slow"]
    T --> NV["navTheme\nReact Navigation dark theme override"]
```

### Color tokens

| Token         | Hex                       | Used for                                       |
| ------------- | ------------------------- | ---------------------------------------------- |
| `bg`          | `#0b0b11`                 | root background                                |
| `bgElevated`  | `#13131c`                 | sheets, nav cards                              |
| `surface`     | `#1a1a25`                 | cards                                          |
| `surfaceAlt`  | `#23232f`                 | inputs, secondary surfaces                     |
| `surfaceHi`   | `#2c2c3a`                 | hover/active                                   |
| `primary`     | `#8b5cf6`                 | brand violet                                   |
| `primaryDark` | `#6d28d9`                 | pressed                                        |
| `accent`      | `#ec4899`                 | brand pink / accent                            |
| `text`        | `#f6f6f8`                 | foreground                                     |
| `textMuted`   | `#9595a4`                 | secondary text                                 |
| `textFaint`   | `#5e5e6c`                 | tertiary text                                  |
| `border`      | `#2a2a38`                 | subtle dividers                                |
| `danger`      | `#f43f5e`                 | destructive                                    |
| `success`     | `#34d399`                 | confirmations                                  |
| `warning`     | `#fbbf24`                 | warnings                                       |

### Mood palette

| Mood        | Emoji | Gradient                          |
| ----------- | :---: | --------------------------------- |
| joy / happy |  😊   | `#f59e0b → #f472b6 → #ec4899`     |
| love        |  🥰   | `#ec4899 → #f472b6 → #fb7185`     |
| excited     |  🤩   | `#f97316 → #ec4899 → #a855f7`     |
| surprised   |  😲   | `#06b6d4 → #22d3ee → #a855f7`     |
| calm        |  😌   | `#10b981 → #22d3ee → #3b82f6`     |
| neutral     |  😌   | `#475569 → #64748b → #94a3b8`     |
| sad         |  😢   | `#1e3a8a → #3b82f6 → #60a5fa`     |
| fearful     |  😨   | `#4c1d95 → #7c3aed → #a855f7`     |
| angry       |  😠   | `#9f1239 → #e11d48 → #f43f5e`     |
| disgust     |  😖   | `#365314 → #65a30d → #a3e635`     |

`moodPaletteFor(emotion)` is case-insensitive and falls back to the brand
gradient with a `🎧` glyph if the mood isn't in the table — so the
Results screen always has *some* coherent palette to render.

### Typography scale

| Token         | Size | Weight | Letter-spacing | Line-height |
| ------------- | ---- | ------ | -------------- | ----------- |
| `display`     | 34   | 900    | -0.5           | 40          |
| `h1`          | 28   | 900    | -0.3           | 34          |
| `h2`          | 22   | 800    | -0.2           | 28          |
| `h3`          | 18   | 800    | -0.1           | 24          |
| `body`        | 15   | 500    | —              | 22          |
| `bodyStrong`  | 15   | 700    | —              | 22          |
| `caption`     | 13   | 600    | —              | 18          |
| `micro`       | 11   | 800    | 1.2 + upper    | —           |

### Spacing + radius

| spacing | px  |  | radius | px  |
| :------ | --: |  | :----- | --: |
| xs      |  4  |  | xs     |  6  |
| sm      |  8  |  | sm     | 10  |
| md      | 16  |  | md     | 16  |
| lg      | 24  |  | lg     | 24  |
| xl      | 36  |  | xl     | 32  |
| xxl     | 56  |  | pill   | 999 |

### Motion

| Token | Duration | Use                                 |
| ----- | -------- | ----------------------------------- |
| fast  | 180 ms   | press feedback                      |
| base  | 260 ms   | screen fade-ins / sheet slides      |
| slow  | 420 ms   | hero entry, progress-rail crossfade |

---

## Networking + API layer

### Axios interceptors

```mermaid
sequenceDiagram
    participant Req as Request interceptor
    participant Out as Outgoing HTTP
    participant Res as Response interceptor
    participant Refresh as refreshSession

    Note over Req: every request
    Req->>Req: if !_skipAuth and accessToken<br/>set Authorization: Bearer …
    Req->>Out: send

    Out-->>Res: response
    alt 200-2xx
        Res-->>Caller: forward
    else 401 + not _skipAuth + not _retried
        Res->>Refresh: single in-flight refresh
        alt refresh OK
            Refresh-->>Res: true
            Res->>Res: strip stale Content-Type
            Res->>Out: replay original
        else refresh fails
            Refresh-->>Res: false
            Res->>Res: clearTokens + onSessionExpired
            Res-->>Caller: reject
        end
    else other error
        Res-->>Caller: reject
    end
```

Notes:

- `_skipAuth` is set explicitly on `login`, `register`, `verify`, `reset`
  and `token/refresh` requests so they can't infinitely loop into the
  refresh flow.
- `_retried` is set after the first replay so a still-401 retry is
  rejected rather than re-replayed forever.
- The Content-Type header is dropped before retry so a retried multipart
  upload gets a fresh boundary.
- `refreshInFlight` collapses concurrent 401s into one refresh — no
  thundering-herd token rotations.

### Endpoint surface

| Operation                            | Endpoint                                       | Auth |
| ------------------------------------ | ---------------------------------------------- | :--: |
| Register                             | `POST /users/register/`                        |  ✗   |
| Login                                | `POST /users/login/`                           |  ✗   |
| Refresh                              | `POST /users/token/refresh/`                   |  ✗   |
| Verify username+email                | `POST /users/verify-username-email/`           |  ✗   |
| Reset password                       | `POST /users/reset-password/`                  |  ✗   |
| Profile                              | `GET /users/user/profile/`                     |  ✓   |
| Update profile (email)               | `PUT /users/user/profile/update/`              |  ✓   |
| Delete account                       | `DELETE /users/user/profile/delete/`           |  ✓   |
| Append mood                          | `POST /users/mood_history/:pid/`               |  ✓   |
| Clear specific mood                  | `DELETE /users/mood_history/:pid/`             |  ✓   |
| Append recommendations               | `POST /users/recommendations/:pid/`            |  ✓   |
| Clear all recommendations            | `DELETE /users/recommendations/:pid/`          |  ✓   |
| Append listening entry               | `POST /users/listening_history/:pid/`          |  ✓   |
| Clear specific listening entry       | `DELETE /users/listening_history/:pid/`        |  ✓   |
| Text emotion                         | `POST /text_emotion`                           |  ✗*  |
| Speech emotion                       | `POST /speech_emotion` (multipart)             |  ✗*  |
| Facial emotion                       | `POST /facial_emotion` (multipart)             |  ✗*  |
| Music recommendation                 | `POST /music_recommendation`                   |  ✗*  |

\* Modal service is currently public; no JWT is sent to it.

### Failure modes

```mermaid
flowchart TB
    F[axios error] --> Q{status?}
    Q -->|401 + can refresh| RT[silent refresh + retry]
    Q -->|401 + cannot refresh| SO[signedOut + Login]
    Q -->|404 on verify| T1[toast: not found]
    Q -->|409 on register| T2[toast: username taken]
    Q -->|400 on register| T3[toast: server error message]
    Q -->|timeout / network on inference| FB[degraded fallback]
    Q -->|other| TO[generic toast]
```

---

## State management

There's no Redux / Zustand / Recoil — the app is small enough that two
patterns cover everything:

1. **`AuthContext`** for app-wide auth status (`loading | signedIn |
   signedOut`) and the small surface of auth actions.
2. **`useFocusEffect` + local component state** for per-screen data.

```mermaid
flowchart LR
    A[AsyncStorage] --> S[services/auth.js<br/>module-level memory]
    S --> C[AuthContext value]
    C --> R[RootNavigator]
    R --> StackA[Signed-out stack]
    R --> StackB[Signed-in tabs + Results]
    StackB --> Home & Profile & Settings
    Home -. useFocusEffect: getProfile() .-> S
    Profile -. useFocusEffect: getProfile() .-> S
    Settings -. useFocusEffect: getProfile() .-> S
```

`useFocusEffect` returns a cleanup that flips a local `active` flag so a
late-resolving fetch doesn't write into an unmounted screen — a small
but important guard for the swipe-back gesture on iOS.

### Per-screen state map

| Screen           | Local state keys                                                                  |
| ---------------- | --------------------------------------------------------------------------------- |
| `LoginScreen`    | `username`, `password`, `loading`                                                 |
| `RegisterScreen` | `username`, `email`, `password`, `confirm`, `loading`, derived `strength` + rules |
| `ForgotPassword` | `step`, `username`, `email`, `password`, `confirm`, `loading`                     |
| `HomeScreen`     | `mode`, `text`, `busy`, `recording`, `profileId`, `moodHistory`                   |
| `ResultsScreen`  | `tracks`, `sortKey`, `market`, `visible`, `loading`, `sheet`                      |
| `ProfileScreen`  | `profile`, `loading`, `refreshing`                                                |
| `SettingsScreen` | `profile`, `loading`, `busy`, `editor`, `emailValue`, `password`, `confirm`       |

---

## Animation cookbook

| Where                | What                                                       | Driver / value                                                            |
| -------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------- |
| Login / Register / Forgot | fade + slide entry                                    | `Animated.parallel(timing(fade,520), spring(slide))`                      |
| Login / Register / Forgot | logo halo pulse (subtle)                              | `loop(timing(halo) 2.4 s)` → opacity 0.12 → 0.22, scale 0.96 → 1.06       |
| Login / Register / Forgot | background orbs drift                                 | `loop(timing(orbA) 5.4 s)`, `loop(timing(orbB) 6.8 s with 400 ms delay)`  |
| Forgot password      | progress-rail width crossfade between steps                | `timing(progress, 380 ms, Easing.out(cubic))` over `width: 0% → 100%`     |
| Home / Voice         | recording pulse ring                                       | `loop(sequence(timing(pulse, 900 ms easeOut), timing(pulse, 900 ms easeIn)))`, scale 1 → 1.35, opacity 0.6 → 0  |
| Home                 | greeting fade-in                                           | `timing(fade, 460 ms)`                                                    |
| Profile              | scroll fade-in on data load                                | `timing(fade, 360 ms)`                                                    |
| Tab bar              | active pill gradient + label crossfade                     | RN re-render only (no Animated)                                           |
| Modals / sheets      | slide-up                                                   | `<Modal animationType="slide">` + `<BlurView intensity>`                  |

All loops use `useNativeDriver: true` where possible (opacity, scale,
translate) so the JS thread never has to publish per-frame updates.

---

## Haptics matrix

[`mobile/src/util/haptics.js`](mobile/src/util/haptics.js) wraps
`expo-haptics` and routes the right impact / notification style to each
gesture:

| Helper       | Style                                | Used in                                            |
| ------------ | ------------------------------------ | -------------------------------------------------- |
| `tapLight`   | `ImpactFeedbackStyle.Light`          | mode-card tap, sheet open, mood-chip tap, refresh  |
| `tapMedium`  | `ImpactFeedbackStyle.Medium`         | mic start/stop, camera capture                     |
| `select`     | `selectionAsync()`                   | tab change                                         |
| `success`    | `NotificationFeedbackType.Success`   | login OK, register OK, save OK, reset OK           |
| `error`      | `NotificationFeedbackType.Error`     | login fail, validation fail, network error toast   |

The util module is platform-safe — calling any helper on web is a no-op.

---

## Toast system

Toasts are managed by a `ToastProvider` at the App root and consumed via
the `useToast()` hook. There are four severity levels, each with its own
icon + accent color:

| Type        | Icon                | Color tint        | Auto-dismiss |
| ----------- | ------------------- | ----------------- | ------------ |
| `success`   | `checkmark-circle`  | `success` green   | 2.4 s        |
| `warning`   | `alert-circle`      | `warning` amber   | 2.4 s        |
| `error`     | `close-circle`      | `danger` red      | 3.0 s        |
| `info`      | `information-circle`| `primary` violet  | 2.4 s        |

A toast queue ensures multiple consecutive `toast.show(...)` calls don't
stomp each other — they're rendered sequentially.

---

## Permissions

| Permission   | When asked                                   | What's collected                |
| ------------ | -------------------------------------------- | ------------------------------- |
| Microphone   | First time the user taps the mic in Voice    | A single short .m4a per session |
| Camera       | First time the user taps "Grant" in Face     | A single front-facing JPG (q=0.6) |
| (none)       | Text mode                                    | Plain text payload              |

Both prompts use Expo's plugin permission strings declared in
[`mobile/app.json`](mobile/app.json):

```json
"plugins": [
  ["expo-camera", { "cameraPermission": "Moodify uses the camera to detect your mood from a photo." }],
  ["expo-av",     { "microphonePermission": "Moodify uses the microphone to detect your mood from your voice." }]
]
```

If a user denies either permission, the corresponding mode falls back to
its empty-state UI; the other two modes keep working.

---

## Data model

The Django API returns a flat `Profile` shape; the mobile app does not
attempt to normalize it locally.

```mermaid
erDiagram
    USER ||--|| PROFILE : "1-to-1"
    PROFILE ||--o{ MOOD_HISTORY : "many"
    PROFILE ||--o{ RECOMMENDATIONS : "many"
    PROFILE ||--o{ LISTENING_HISTORY : "many"

    USER {
        string id
        string username
        string email
    }
    PROFILE {
        string id
        string username
        string email
        string[] mood_history
        Track[] recommendations
        string[] listening_history
    }
    MOOD_HISTORY {
        string emotion
    }
    RECOMMENDATIONS {
        string name
        string artist
        string album
        string preview_url
        string external_url
        string image_url
        int popularity
        int duration_ms
        string release_date
    }
    LISTENING_HISTORY {
        string entry "name — artist"
    }
```

The `Track` shape on `recommendations` matches the one returned by the
Modal `/music_recommendation` endpoint exactly — no client-side mapping.
`listening_history` is stored as a flat array of strings, formatted
`name — artist`, for simplicity.

---

## Security model

```mermaid
flowchart TB
    subgraph Client
        Mem[in-memory tokens]
        AS[AsyncStorage]
        Mem <-->|hydrate/persist| AS
    end
    subgraph Wire
        TLS[HTTPS only]
    end
    subgraph Server
        DJ[Django REST API<br/>JWT auth]
        MD[Modal Inference<br/>public]
    end

    Mem -->|Authorization: Bearer| TLS --> DJ
    Mem -.no JWT.-> TLS --> MD

    style Mem fill:#8b5cf6,color:#fff
    style AS fill:#1a1a25,color:#fff
```

- **Tokens never leave the device unencrypted** — AsyncStorage is sandboxed per app on both platforms.
- **`_skipAuth` flag** prevents accidental Bearer leaks to non-Django hosts (the Modal service receives no JWT).
- **Permission strings** are clear about why each capability is requested — no opaque "access required" prompts.
- **No third-party analytics** are bundled in the app; no PII leaves the device except via the documented endpoints.
- The Django server enforces the actual security policy (password hashing, rate limits, JWT signing); the mobile client only stores and presents tokens.

---

## Performance notes

| Concern                        | Mitigation                                                                  |
| ------------------------------ | --------------------------------------------------------------------------- |
| FlatList scroll perf           | Compact `TrackCard` rows; `onEndReached` page size 12; `removeClippedSubviews` default-on |
| Multiple `Animated` loops      | Native-driver wherever possible (opacity / scale / translate)               |
| Large profile payloads         | `mood_history` and `listening_history` are sliced to last 15 for display    |
| Re-renders on focus            | `useFocusEffect` with cleanup flag prevents stale-render on swipe-back      |
| Modal cold starts              | 60 s timeout + automatic fallback playlist with `degraded: true`            |
| Concurrent 401 storm           | Single in-flight refresh via `refreshInFlight`                              |
| Photo upload size              | `expo-camera` quality clamped to `0.6` + `skipProcessing: true`             |
| Audio file size                | `Audio.RecordingOptionsPresets.HIGH_QUALITY` (m4a AAC) — bounded by user record length |

---

## Accessibility

- All `Pressable`s set `accessibilityRole="button"`.
- Tab bar items set `accessibilityState={ selected: true }` on the active
  tab and a meaningful `accessibilityLabel` for VoiceOver / TalkBack.
- Iconography is paired with text labels everywhere it carries meaning
  (sheets, mode cards, settings rows).
- Contrast on the dark theme passes 4.5 : 1 for body copy against
  `colors.bg` and `colors.surface`.
- Multiline `TextField` does not auto-focus, preventing keyboard "jump"
  on screen entry.

Known gaps (slated):

- `accessibilityLabel` is not yet set on every mood-chip emoji.
- `expo-haptics` calls aren't routed through a user-controllable
  "reduce motion / haptics" preference.

---

## Platform differences (iOS vs Android)

| Surface             | iOS                                                 | Android                                                     |
| ------------------- | --------------------------------------------------- | ----------------------------------------------------------- |
| Status bar          | `<StatusBar style="light" />` (always light)        | Same — translucent over `colors.bg`                         |
| Tab bar safe area   | `useSafeAreaInsets().bottom` (~34 pt on Pro models) | Usually 0; falls back to `spacing.sm`                       |
| Blur                | Native `expo-blur` (UIVisualEffectView)             | Tint-only fallback on older devices                         |
| KeyboardAvoiding    | `behavior="padding"` on iOS, `undefined` on Android | Android handles its own resize automatically                |
| Audio recording     | Requires `allowsRecordingIOS:true` before recording | Just permission                                             |
| Haptics             | Full taptic engine support                          | Vibration only on supported devices                         |
| Camera permission   | One-shot prompt, persistent                         | One-shot prompt + settings deeplink fallback                |
| Modal sheet         | Slide-up over scrim                                 | Slide-up over scrim (identical via `<Modal>`)               |

---

## Building, running, shipping

### 1. Local dev

```bash
cd mobile
npm install
cp .env.example .env        # set EXPO_PUBLIC_API_URL / EXPO_PUBLIC_MODAL_API_URL
npm start                   # then press i (iOS), a (Android), w (web)
```

If port `8081` is already in use by another Expo project, start on a
different port:

```bash
npx expo start --port 8083
```

### 2. EAS production build

```bash
npx eas-cli login
npx eas-cli build:configure
npx eas-cli env:create EXPO_PUBLIC_API_URL --value https://moodify-backend-api.vercel.app
npx eas-cli env:create EXPO_PUBLIC_MODAL_API_URL --value https://hoangsonww--moodify-inference-inferenceservice-web.modal.run
npx eas-cli build -p ios       # or -p android
```

The two `EXPO_PUBLIC_*` env vars are the **only** deployment-specific
inputs the app needs — everything else is baked into `theme.js` /
`config.js`.

### 3. Inline overrides

For a one-off build against a staging API:

```bash
EXPO_PUBLIC_API_URL=https://staging-api.example.com \
EXPO_PUBLIC_MODAL_API_URL=https://staging-modal.example.com \
npx expo start
```

### 4. Bundle identifiers

| Platform | Identifier              |
| -------- | ----------------------- |
| iOS      | `com.moodify.mobile`    |
| Android  | `com.moodify.mobile`    |

iPad support is enabled (`ios.supportsTablet: true`).

### 5. Release pipeline

```mermaid
flowchart LR
    Dev[Local dev<br/>Expo Go] --> EAS[EAS Build]
    EAS -->|iOS .ipa| TF[TestFlight]
    EAS -->|Android .aab| PS[Play Console]
    TF --> AS[App Store]
    EAS --> OTA[Expo OTA update]
    OTA --> Users[(Installed users)]
```

OTA updates (Expo Updates) ship JS-only changes without a store re-review;
native dep bumps still require a fresh EAS build.

---

## Testing on simulator + device

### iOS simulator

```bash
# 1. Boot a simulator
xcrun simctl list devices available | grep iPhone
xcrun simctl boot 'iPhone 16 Pro'
open -a Simulator

# 2. Start Metro + open Expo Go in the simulator
cd mobile
npx expo start --ios --port 8083

# 3. Take a screenshot of the booted simulator
xcrun simctl io booted screenshot ~/Desktop/moodify-shot.png
```

### Android emulator

```bash
# 1. Boot an emulator (from Android Studio AVD manager)
emulator -avd Pixel_8_Pro_API_35

# 2. Start Metro + open Expo Go in the emulator
cd mobile
npx expo start --android --port 8083

# 3. Take a screenshot
adb exec-out screencap -p > ~/Desktop/moodify-shot.png
```

### On a physical device

1. `npm install -g expo-cli` (optional but convenient).
2. Install **Expo Go** on the device from the App Store / Play Store.
3. Run `npx expo start` on the dev machine on the same Wi-Fi network.
4. Scan the QR code from the Expo CLI in Expo Go.

For testing offline-degraded behavior, kill the network in Settings
and trigger an analysis — the result screen should still render with
`degraded: true` + a curated fallback playlist.

---

## Capturing screenshots

The screenshots that ship in
[`mobile/docs/screenshots/`](mobile/docs/screenshots) were generated by
driving the app through each state and snapping each one. The exact
sequence:

```mermaid
flowchart TD
    A[Sign in] --> B[Home / Text]
    B --> C[Tap Voice → record]
    C --> D[Stop → Tap Face → grant cam]
    D --> E[Tap Text → analyze]
    E --> F[Results]
    F --> G[Sort pill → sheet]
    G --> H[Close → Market pill → sheet]
    H --> I[Back → Profile tab]
    I --> J[Settings tab]
    J --> K[Tap Email row → modal]
    K --> L[Cancel → Tap Password row → modal]
    L --> M[Cancel → Logout]
    M --> N[Login → tap Create account → Register]
    N --> O[Back → tap Forgot password → Verify]
    O --> P[Fill creds → Verify → Reset]
    P --> Q[Back to Login]
```

Each state is captured with the platform's native screenshot tool:

```bash
# iOS
xcrun simctl io booted screenshot mobile/docs/screenshots/ios/NN-name.png

# Android
adb exec-out screencap -p > mobile/docs/screenshots/android/NN-name.png
```

---

## Operations playbook

```mermaid
flowchart TB
    Inc[Incident reported] --> R{Where?}
    R -->|Modal cold start| W[Wait + retry, fallback playlist already handles it]
    R -->|Django 500s| L[Check Vercel logs + DB connectivity]
    R -->|App crash on launch| H[Send Hermes stack trace via expo log]
    R -->|Spike in 401s| T[Check JWT signing key on Django; bump if rotated]
    R -->|Tab bar misaligned| S[Check safe-area-insets API version on RN 0.74]
    R -->|Camera/mic prompt loop| P[Force-quit; user must clear OS-level permission]
```

### Runbooks

- **Token rotation:** rotate the Django `SECRET_KEY`; every device gets
  a 401, then the response interceptor calls `refreshSession()`. If the
  refresh token is also invalidated, users are bounced to Login.
- **API URL change:** ship a new EAS build with the new
  `EXPO_PUBLIC_API_URL` env var, **or** publish an OTA update if the
  fallback URL in `config.js` was updated.
- **Modal endpoint change:** identical flow with
  `EXPO_PUBLIC_MODAL_API_URL`.
- **Bumping React Native / Expo:** requires a fresh native build; OTA
  cannot ship native dependency upgrades.

---

## Troubleshooting

| Symptom                                      | Likely cause                                       | Fix                                                                                  |
| -------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Stuck on "Reading your mood…"                | Modal cold start > 60 s                            | Wait — next call will be warm; or check Modal dashboard.                              |
| Always lands on Login after open             | Refresh token expired                              | This is expected; re-sign-in.                                                         |
| Camera tab is empty even after Allow         | Stale permission cache                             | Quit the app, reopen; if it persists clear iOS Settings → Moodify → Camera.           |
| Mic recording fails immediately              | iOS Audio session conflict                         | The screen calls `setAudioModeAsync({allowsRecordingIOS:true})`; try restarting Expo. |
| Port 8081 in use                             | Another Expo project on the same machine           | `npx expo start --port 8083`.                                                        |
| `network error` on every call                | `.env` URLs missing / wrong                        | Verify `EXPO_PUBLIC_*` envs; fallbacks in `config.js` should otherwise work.          |
| Sign-in succeeds but immediate Logout        | System clock skew vs JWT `exp`                     | The check uses a 30 s skew tolerance — if your device clock is more than 30 s ahead, sync NTP. |
| Tab bar overlaps content                     | Custom safe-area edge fallback                     | Check `useSafeAreaInsets()` on the device's RN version.                              |
| `expo-blur` not rendering on Android         | Older device without RenderEffect                  | Falls back to tint-only — visual but functional.                                     |

---

## Roadmap

Things not yet built that are obvious next steps:

- **Spotify playback link** alongside the existing Deezer search link.
- **In-app preview player** (Deezer 30 s previews + `expo-av` playback).
- **Mood streaks** on Profile (consecutive-day analyses).
- **Share sheet** for a generated playlist.
- **Apple Sign-in / Google Sign-in** in addition to username/password.
- **Push notifications** when a "weekly wrap" of moods is ready.
- **Reduce-motion / reduce-haptics** preference toggle in Settings.
- **Unit tests** for `services/auth.js` interceptor behavior, and
  end-to-end tests via **Maestro** or **Detox** against the simulator.
- **Internationalization** via `expo-localization` + an i18n catalog.

---

## Appendix — file index

The most-referenced source files in this document:

- App shell — [`mobile/App.js`](mobile/App.js)
- Theme tokens — [`mobile/theme.js`](mobile/theme.js)
- API base URLs — [`mobile/config.js`](mobile/config.js)
- Auth context — [`mobile/src/context/AuthContext.js`](mobile/src/context/AuthContext.js)
- Auth service + interceptors — [`mobile/src/services/auth.js`](mobile/src/services/auth.js)
- Inference + history service — [`mobile/src/services/emotion.js`](mobile/src/services/emotion.js)
- Tab navigator (custom blurred pill) — [`mobile/src/navigation/TabNavigator.js`](mobile/src/navigation/TabNavigator.js)
- Login / Register / Forgot — [`mobile/src/screens/LoginScreen.js`](mobile/src/screens/LoginScreen.js), [`RegisterScreen.js`](mobile/src/screens/RegisterScreen.js), [`ForgotPasswordScreen.js`](mobile/src/screens/ForgotPasswordScreen.js)
- Home / Results / Profile / Settings — [`HomeScreen.js`](mobile/src/screens/HomeScreen.js), [`ResultsScreen.js`](mobile/src/screens/ResultsScreen.js), [`ProfileScreen.js`](mobile/src/screens/ProfileScreen.js), [`SettingsScreen.js`](mobile/src/screens/SettingsScreen.js)
- Face capture — [`mobile/src/components/FaceCapture.js`](mobile/src/components/FaceCapture.js)
- Bottom-sheet picker — [`mobile/src/components/OptionSheet.js`](mobile/src/components/OptionSheet.js)
- Track row — [`mobile/src/components/TrackCard.js`](mobile/src/components/TrackCard.js)
- Mood hero card — [`mobile/src/components/MoodHero.js`](mobile/src/components/MoodHero.js)
- Toast system — [`mobile/src/components/Toast.js`](mobile/src/components/Toast.js)
- Haptics util — [`mobile/src/util/haptics.js`](mobile/src/util/haptics.js)

For the high-level project README see [`README.md`](README.md); for
infrastructure setup see [`INFRASTRUCTURE_SETUP.md`](INFRASTRUCTURE_SETUP.md);
for deployment see [`DEPLOYMENT.md`](DEPLOYMENT.md); for the overall
system architecture see [`ARCHITECTURE.md`](ARCHITECTURE.md).
