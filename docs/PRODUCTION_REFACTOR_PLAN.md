# Moodify — Production Refactor Plan: ML Inference Separation

> Status: **Implemented** on branch `feat/refactor-api-ml-inference`.
> Phases 1–4 and 6 (§10) are complete with functional, production-ready
> code. Phase 5 (live deploy to Modal/Vercel + the SQLite→Mongo data
> migration) is operational work that must be run by a human with the
> production credentials — see §10.
>
> Implementation notes:
> - Modal service (`modal_inference/`): all three models load once per
>   container; speech reads any audio container via librosa/ffmpeg; the
>   facial detector uses the `fer` package's bundled weights directly
>   (the legacy `.pt` was just a pickled `FER` object — see §4.2). The
>   FastAPI surface is extracted into `service.py` for testability.
> - Django (`backend/`): no ML dependencies; MongoDB-only; JWT auth;
>   `manage.py check` is clean.
> - Frontend + mobile: API base URLs centralised in `config.js`,
>   env-driven; speech/facial now upload directly to Modal.
> - **Test coverage: 130 tests, all passing** — 76 backend (auth, JWT,
>   profile/history with ownership checks, inference proxy, the Modal
>   HTTP client) on an in-memory mongomock DB, and 54 for the Modal
>   service (config, schemas, auth, Spotify client, inference wrappers,
>   and the full FastAPI surface via `TestClient`). Both suites run in CI.

---

## 1. Executive Summary

Moodify today is a monolith: a Django REST API that loads PyTorch /
Transformers / scikit-learn / OpenCV models **in-process** and runs
inference on the web request thread. This plan separates the system into
three independently deployable, independently scalable tiers:

| Tier | Hosts | Platform | Responsibility |
|------|-------|----------|----------------|
| Web API | Django (DRF) | **Vercel** (serverless) | Auth, user profiles/history, text-emotion + music proxy, API gateway |
| ML Inference | FastAPI on Modal | **Modal** (CPU, keep-warm) | Text / speech / facial emotion + music recommendation |
| Data | MongoDB Atlas | Atlas | Users **and** profiles (single datastore) |

The driving goals: (a) make the web tier deployable to Vercel — impossible
today because `backend/api/views.py` imports `torch`, `transformers` and
`moviepy`; (b) eliminate per-request model loading, the single largest
latency source; (c) lock down a production-grade security and observability
posture.

### Decisions locked in (from requirements review)

| Question | Decision |
|----------|----------|
| Relational/auth DB on Vercel | **Consolidate onto MongoDB** — drop SQLite entirely |
| Media (audio/image) upload path | **Direct browser → Modal** — bypasses Vercel's ~4.5 MB body cap |
| Modal compute tier | **CPU + keep-warm** containers; NVIDIA GPU documented as a future flip |
| Execution scope of this pass | **Plan + scaffolding** — skeletons only, full build deferred |

---

## 2. Current Architecture & Problems

```
            ┌──────────────────────────────────────────────┐
  React  ──▶│  Django (Render)                              │
  Mobile    │  api/views.py  ──imports──▶ torch, transformers│
            │                            librosa, opencv,   │
            │                            moviepy, sklearn    │
            │  in-process inference on the request thread    │
            │  users/views.py ──▶ Django User (SQLite)       │
            └───────────────┬───────────────┬───────────────┘
                            │               │
                      MongoDB Atlas      Spotify API
                      (UserProfile)
```

Concrete problems found in the code:

1. **Inference is in-process.** `backend/api/views.py:10-13` imports the ML
   modules directly. The Vercel Python bundle would include `torch` +
   `transformers` + `tensorflow` + `opencv` — multiple GB, far past Vercel's
   250 MB unzipped limit. **Hard blocker for Vercel.**
2. **Models reload on every request.** `text_emotion.py:13-14` calls
   `from_pretrained` per request; `speech_emotion.py:127` unpickles model +
   scaler per request. Only `facial_emotion.py` caches (`_model` global).
   This adds seconds of latency to every call.
3. **SQLite for Django auth** (`settings.py:62-67`). Vercel's filesystem is
   ephemeral and read-only at runtime — SQLite cannot persist. **Hard
   blocker.**
4. **Redis cache points at `localhost:6379`** (`settings.py:122`) — invalid
   in any serverless deploy.
5. **`CORS_ALLOW_ALL_ORIGINS = True`** (`settings.py:85`) with
   `CORS_ALLOW_CREDENTIALS = True` — insecure for production.
6. **Spotify token fetched every call** (`utils.py:get_spotify_access_token`)
   — an extra network round-trip per recommendation; the token is valid ~1 h.
7. **Silent random fallbacks.** `speech_emotion.py:149` and
   `facial_emotion.py:74-86` return a *random* emotion on failure — failures
   are invisible and results are non-deterministic.
8. **Label-count mismatch.** `config.py` sets `num_labels: 6` but
   `text_emotion.py:25` lists only 5 labels — an `IndexError` waiting to
   happen if the model predicts class index 5.
9. **Fixed temp filename.** `speech_emotion.py:80` writes to a hard-coded
   `temp_audio.wav` — a race condition under concurrent requests.
10. **Two web servers, one logic.** `ai_ml/src/api/emotion_api.py` (Flask)
    and `backend/api/views.py` (Django) duplicate the same inference calls.

---

## 3. Target Architecture

```
                         ┌─────────────────────────────┐
                         │   React frontend / Mobile    │
                         └──────┬───────────────┬───────┘
            text / auth / history│               │ audio + image (direct upload)
                                 ▼               ▼
            ┌──────────────────────────┐   ┌──────────────────────────────┐
            │  Django REST API         │   │  Modal ML Inference Service   │
            │  (Vercel, serverless)    │   │  (FastAPI ASGI, CPU warm)     │
            │                          │   │                               │
            │ • JWT auth (Mongo users) │   │ • @modal.enter loads all 3    │
            │ • profiles / history     │──▶│   models ONCE per container   │
            │ • /api/text_emotion  ────┼──▶│ • /text_emotion               │
            │ • /api/music_recommend ──┼──▶│ • /speech_emotion             │
            │   (proxy to Modal)       │   │ • /facial_emotion             │
            │ • NO ML dependencies     │   │ • /music_recommendation       │
            └────────────┬─────────────┘   │ • /health                     │
                         │                 │ • min_containers=1 (no cold)  │
                         │                 └──────────┬───────────┬────────┘
                         │                            │           │
                         ▼                            ▼           ▼
                  ┌──────────────┐            ┌──────────────┐ ┌────────────┐
                  │ MongoDB Atlas│            │ Modal Volume │ │ Spotify API│
                  │ users +      │            │ model weights│ │            │
                  │ profiles     │            └──────────────┘ └────────────┘
                  └──────────────┘
```

### Request flows

- **Text emotion:** browser → `POST /api/text_emotion/` (Django) → Django
  `inference_client` → `POST {MODAL}/text_emotion` → `{emotion,
  recommendations}` returned through Django. Django attaches the
  authenticated user and may persist mood history.
- **Speech / facial emotion:** browser → `POST {MODAL}/speech_emotion` (or
  `/facial_emotion`) **directly**, with the user's JWT in the
  `Authorization` header. Modal verifies the JWT (shared signing key),
  runs inference, calls Spotify, returns `{emotion, recommendations}`. The
  frontend then POSTs the result to Django's history endpoints.
- **Music only:** browser → `POST /api/music_recommendation/` (Django) →
  proxied to `{MODAL}/music_recommendation`.

### Why this split

- Modal has no request-body cap and is built for GPU/CPU model serving, so
  media uploads go straight there — Vercel's ~4.5 MB cap never applies.
- Django keeps a single small surface (text + auth + history) and ships
  with **zero ML dependencies**, so the Vercel bundle is tiny and cold
  starts are fast.
- One implementation of inference (Modal). The Flask app
  `ai_ml/src/api/emotion_api.py` is retired.

---

## 4. Component Plan — Modal ML Inference Service

New top-level directory `modal_inference/` — a self-contained, separately
deployable service. The existing `ai_ml/` directory is kept for **training
scripts and model source**; runtime inference moves to `modal_inference/`.

### 4.1 Modal application (`modal_inference/modal_app.py`)

- `modal.App("moodify-inference")`.
- A **CPU container image**: `debian_slim` + `apt_install("ffmpeg",
  "libsndfile1")` + CPU-only PyTorch wheels
  (`index_url=https://download.pytorch.org/whl/cpu`) +
  `pip_install_from_requirements`.
- A **`modal.Volume`** (`moodify-models`) holding model weights, mounted at
  `/models`. Weights are *not* baked into the image — the volume keeps the
  image small and lets weights update without an image rebuild.
- A single **`@app.cls`** `InferenceService`:
  - `@modal.enter()` `load_models()` — loads BERT tokenizer+model, the
    sklearn speech model+scaler, and the facial `.pt` model **once** per
    container into `self.*`. This is the core fix for problem #2.
  - `@modal.asgi_app()` `web()` — returns a FastAPI app whose routes call
    `self.*` models. No per-request loading.
  - Tuning: `min_containers=1` (keep one container warm — eliminates cold
    starts), `scaledown_window=300`, `cpu=2.0`, `memory=4096`.
- **Endpoints:** `GET /health`, `POST /text_emotion`, `POST /speech_emotion`,
  `POST /facial_emotion`, `POST /music_recommendation`.
- A **`download_models`** Modal function (`modal run
  modal_app.py::download_models`) ports `backend/download_models.py` to fetch
  weights from Google Drive into the Volume and `commit()` it. One-time
  setup + re-runnable on model updates.

> **Modal API note:** scaffolding uses `min_containers` / `scaledown_window`
> (Modal ≥ 0.64 / 1.x). Older SDKs use `keep_warm` / `container_idle_timeout`.

### 4.2 Inference modules (`modal_inference/inference/`)

Refactor each model into a **class with explicit `load()` and
`predict()`** so the container loads once and the web layer just calls
`predict()`:

- `text_emotion.py` — `TextEmotionModel`. **Fix the label mismatch
  (problem #8):** derive labels from the model's `config.id2label` instead
  of a hard-coded 5-item list.
- `speech_emotion.py` — `SpeechEmotionModel`. MFCC via librosa + sklearn
  predict. **Fix problem #9:** use `tempfile.NamedTemporaryFile` for the
  WAV conversion, never a fixed name.
- `facial_emotion.py` — `FacialEmotionModel`. **Verification item:** the
  current `.pt` is loaded with `torch.load` and `.top_emotion()` is called
  — that method belongs to the `fer` library's `FER` class. The exact
  dependency (`fer`, `facenet-pytorch`, or a plain `nn.Module`) must be
  confirmed and `requirements.txt` trimmed accordingly.
- **Replace silent random fallbacks (problem #7)** with a structured
  result: return `{emotion, confidence, degraded: true}` and log the cause,
  so the frontend/observability can see when a model failed.

### 4.3 Recommendation (`modal_inference/recommendation/music_recommendation.py`)

Port `ai_ml/src/recommendation/` + `utils.py`, plus:
- **Cache the Spotify token in-process** with its real TTL (`expires_in`,
  ~3600 s) — fixes problem #6.
- Optionally cache recommendations per `(emotion, market)` for a short TTL
  via `modal.Dict` so repeated emotions skip the Spotify call.

### 4.4 Auth (`modal_inference/auth.py`)

Modal endpoints are internet-facing, so every write endpoint validates a
bearer token. Two accepted credentials:
1. **End-user JWT** — issued by Django, HS256, signed with the shared
   `JWT_SIGNING_KEY`. Used for direct browser → Modal media calls.
2. **Service token** — `MODAL_SERVICE_TOKEN`, a shared secret for
   Django → Modal proxy calls (text / music).

Plus: CORS restricted to the known frontend origin(s); a lightweight
per-IP rate limiter; request size limits.

### 4.5 Secrets & config

Modal `Secret` `moodify-secrets` injects `SPOTIFY_CLIENT_ID`,
`SPOTIFY_CLIENT_SECRET`, `JWT_SIGNING_KEY`, `MODAL_SERVICE_TOKEN`,
`ALLOWED_ORIGINS`. `config.py` centralizes paths (`/models/...`) and env
reads.

---

## 5. Component Plan — Django on Vercel

### 5.1 Strip ML from the web tier

- Rewrite `backend/api/views.py`: delete the
  `from ai_ml.src.models...` / `moviepy` imports. `text_emotion` and
  `music_recommendation` views call the new `inference_client`.
- `speech_emotion` / `facial_emotion` views + their routes in
  `backend/api/urls.py` are **removed** — that traffic goes browser→Modal.
  (Optionally keep them for one release as thin 308 redirects to Modal for
  backward compatibility, then delete.)
- New `backend/api/services/inference_client.py` — a `requests`/`httpx`
  client to the Modal service: base URL from `MODAL_INFERENCE_URL`, sends
  the `MODAL_SERVICE_TOKEN`, with timeout + one retry + clear error
  surfacing.

### 5.2 Vercel deployment

- Vercel project **Root Directory = `backend/`**.
- `backend/vercel.json` — `@vercel/python` build of `vercel_wsgi.py`,
  all routes rewritten to it.
- `backend/vercel_wsgi.py` — exposes `app = backend.wsgi.application`.
  (Named to avoid colliding with the existing Django app package `api/`.)
- `backend/requirements-vercel.txt` — slim, **no** torch / tensorflow /
  transformers / librosa / opencv / moviepy / spotipy. At deploy time this
  becomes the `requirements.txt` Vercel installs (rename, or set a custom
  install command).
- **Static files / Swagger:** `drf-yasg` needs collected static assets.
  Add a Vercel `buildCommand` running `collectstatic`; WhiteNoise serves
  them. (Alternative: migrate to `drf-spectacular` with CDN-hosted UI.)

### 5.3 Settings changes (`backend/backend/settings.py`)

- `DATABASES = {}` — no SQL database (Django 5 permits this).
- `INSTALLED_APPS`: drop `admin`, `auth`, `sessions`, `messages`,
  `allauth*`, `sites`, `authtoken`. Keep `rest_framework`,
  `rest_framework_mongoengine`, `corsheaders`, `drf_yasg`.
- `MIDDLEWARE`: drop session / auth / messages / allauth middleware.
- `CACHES`: point at **Upstash Redis** (serverless, `rediss://`) via env,
  or `LocMemCache` as a no-op. Never `localhost`.
- `CORS_ALLOW_ALL_ORIGINS = False`; set explicit `CORS_ALLOWED_ORIGINS`.
- `DEBUG` from env (default `False`); `ALLOWED_HOSTS` from env (Vercel
  domain + custom domain); `SECRET_KEY` required from env.
- `SIMPLE_JWT["SIGNING_KEY"]` set to a **dedicated** `JWT_SIGNING_KEY` env
  var — the same value handed to Modal.

---

## 6. Component Plan — MongoDB Consolidation

Drop SQLite; MongoDB Atlas becomes the only datastore.

- **`backend/users/documents.py`** — a `mongoengine` `User` document
  (`username` unique, `email`, `password` hash, `is_active`,
  `created_at`). Password hashing uses `django.contrib.auth.hashers`
  (`make_password` / `check_password`) — these are pure functions and need
  **no** database or the `auth` app.
- **`backend/users/tokens.py`** — issue access/refresh JWTs (PyJWT, HS256,
  shared `JWT_SIGNING_KEY`), claims `{sub: user_id, username, type, iat,
  exp}`.
- **`backend/users/authentication.py`** — a DRF `BaseAuthentication` class
  that decodes the JWT and loads the Mongo `User`. Set as
  `DEFAULT_AUTHENTICATION_CLASSES`.
- Rewrite `backend/users/views.py` — `register` / `login` /
  `reset_password` / `verify_username_email` use the Mongo `User` instead
  of `django.contrib.auth.models.User`. `UserProfile` is unchanged
  (already `mongoengine`); link profile to user by `username`.
- **Data migration:** a one-off script exporting existing
  `auth_user` rows from `db.sqlite3` into the Mongo `users` collection
  (preserving the existing PBKDF2 password hashes — Django's hashers verify
  them as-is). Run once before cutover.

> Alternative considered: `django-mongodb-backend` (keeps the Django ORM /
> admin on Mongo). Rejected for now — it would run alongside the existing
> heavy `mongoengine` usage on the same DB, adding two ODMs. The
> `mongoengine`-only path is lower-risk given the codebase already commits
> to `mongoengine`.

---

## 7. NVIDIA Inference Assessment

Requested: assess incorporating NVIDIA inference. Honest assessment for the
**current** model sizes (BERT-base ≈110 MB, a 2.5 MB facial CNN, a 370 KB
sklearn RandomForest):

| Option | Fit today | Notes |
|--------|-----------|-------|
| **Modal NVIDIA GPU** (`gpu="T4"/"L4"/"A10G"`) | Optional | One-line change on the `@app.cls` decorator. With CPU keep-warm, BERT-base inference is already ~50–150 ms warm — GPU is not yet justified by latency. |
| **TensorRT** (compile BERT) | Future | 2–5× lower latency, but only on GPU. Worthwhile *after* moving text to GPU under sustained load. Drop-in optimization, not an architecture change. |
| **NVIDIA Triton Inference Server** | Overkill now | Dynamic batching, concurrent multi-model serving, model ensembles. Real value only at high concurrency or with more/larger models. Can run inside a Modal GPU container when needed. |
| **NVIDIA NIM** | Not applicable | Pre-built microservices for *foundation* models. These are small custom classifiers — NIM only becomes relevant if emotion detection is reworked onto an LLM. |

**Recommendation:** stay on **CPU + keep-warm** now (per the locked
decision). Design the Modal classes so the GPU flip is one line. Concrete
trigger to revisit: sustained **p95 inference latency > 400 ms** or
**> ~20 req/s** per container. At that point: (1) add `gpu="T4"` to the
`@app.cls`; (2) install GPU PyTorch (`requirements-gpu.txt`, scaffolded);
(3) optionally TensorRT-compile BERT; (4) adopt Triton only if running many
models with heavy batching. This plan ships `requirements-gpu.txt` and the
trigger so the path is ready without committing cost today.

---

## 8. Performance, Security & Observability

**Performance**
- Load models once per container via `@modal.enter()` (kills problem #2).
- `min_containers=1` keep-warm — no cold starts on the hot path.
- Cache the Spotify token for its TTL; optionally cache recommendations per
  `(emotion, market)`.
- Run Spotify calls and any DB writes concurrently where possible.
- Django stays dependency-light → fast Vercel cold starts.

**Security**
- Lock CORS to known origins on both tiers.
- Every Modal write endpoint requires a valid JWT or the service token.
- Secrets only via Modal `Secret` / Vercel env vars — never committed.
- Add request-size limits and per-IP rate limiting on Modal.
- Re-enable Django security headers (`SECURE_*`, HTTPS redirect handled by
  Vercel).

**Observability**
- Structured JSON logging on both tiers (model, latency, `degraded` flag).
- `/health` on Modal returns model-loaded status for uptime checks.
- Replace silent random fallbacks with explicit `degraded` responses +
  error logs.
- Optional: emit per-model latency metrics; wire Sentry on both tiers.

---

## 9. Scaffolding Delivered in This Pass

Skeletons only — every file is marked with `TODO(impl)` where logic is
deferred.

```
docs/PRODUCTION_REFACTOR_PLAN.md          ← this document

modal_inference/
  modal_app.py                  Modal App: image, Volume, InferenceService, ASGI app
  config.py                     env + model paths
  auth.py                       JWT + service-token verification
  schemas.py                    Pydantic request/response models
  download_models.py            populate the Modal Volume from Google Drive
  requirements.txt              CPU inference dependencies
  requirements-gpu.txt          NVIDIA GPU variant (future flip)
  .env.example                  required secrets
  README.md                     deploy / run instructions
  inference/__init__.py
  inference/text_emotion.py     TextEmotionModel  (load-once class)
  inference/speech_emotion.py   SpeechEmotionModel
  inference/facial_emotion.py   FacialEmotionModel
  recommendation/__init__.py
  recommendation/music_recommendation.py  Spotify client + token cache

backend/
  vercel.json                   Vercel build/route config
  vercel_wsgi.py                Vercel WSGI entrypoint
  requirements-vercel.txt       slim, ML-free dependency set
  api/services/__init__.py
  api/services/inference_client.py   HTTP client → Modal
  users/documents.py            mongoengine User document
  users/tokens.py               JWT issue/decode helpers
  users/authentication.py       DRF auth backed by Mongo User
```

---

## 10. Implementation Phases (deferred — for review)

1. **Modal service** — port inference into the load-once classes, finish
   `modal_app.py`, populate the Volume, deploy, verify all four endpoints.
   *Verify the facial-model dependency here.*
2. **MongoDB auth** — implement `documents.py` / `tokens.py` /
   `authentication.py`, rewrite `users/views.py`, write + run the SQLite→
   Mongo migration script.
3. **Django slim-down** — rewrite `api/views.py` to use `inference_client`,
   remove ML routes/imports, update `settings.py`, finalize `vercel.json`.
4. **Frontend** — point media uploads at `MODAL_INFERENCE_URL`; keep
   text/music on the Django base URL; add the JWT header to Modal calls.
5. **Deploy + cut over** — deploy Modal, deploy Django to Vercel, run the
   data migration, switch DNS/frontend env, monitor, then retire Render +
   the Flask app + `ai_ml/src/api/`.
6. **Hardening** — caching, rate limiting, structured logging, Sentry, load
   test; capture the GPU/Triton trigger thresholds.

---

## 11. Environment Variables

| Variable | Django (Vercel) | Modal | Purpose |
|----------|:--:|:--:|---------|
| `MONGO_DB_URI` / `MONGO_DB_USERNAME` / `MONGO_DB_PASSWORD` | ✓ | – | MongoDB Atlas connection |
| `SECRET_KEY` | ✓ | – | Django crypto |
| `JWT_SIGNING_KEY` | ✓ | ✓ | **Shared** HS256 key — JWTs issued by Django, verified by Modal |
| `MODAL_SERVICE_TOKEN` | ✓ | ✓ | **Shared** service secret for Django→Modal proxy calls |
| `MODAL_INFERENCE_URL` | ✓ | – | Base URL of the deployed Modal service |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | – | ✓ | Spotify API (now Modal-only) |
| `ALLOWED_ORIGINS` / `CORS_ALLOWED_ORIGINS` | ✓ | ✓ | Locked-down CORS |
| `ALLOWED_HOSTS` | ✓ | – | Django host allowlist |
| `REDIS_URL` | ✓ | – | Upstash Redis (optional cache) |
| `DEBUG` | ✓ | – | Default `False` |

---

## 12. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Facial model's `.top_emotion()` needs an undetermined library | Verify in Phase 1 before finalizing `requirements.txt`; isolated, low blast radius |
| SQLite→Mongo user migration data loss | One-off script, dry-run first, keep `db.sqlite3` as backup; Django hashers verify existing PBKDF2 hashes unchanged |
| Vercel cold starts on Django | ML-free slim bundle keeps cold start low; keep-warm is on Modal where it matters |
| Direct browser→Modal abused | JWT required, CORS locked, per-IP rate limiting, request-size caps |
| Modal keep-warm cost | One small CPU container; flip `min_containers` to 0 off-peak if needed |
| Swagger static assets on Vercel | `collectstatic` in build + WhiteNoise, or migrate to `drf-spectacular` |
| Two latency hops for proxied text | Text payloads are tiny; acceptable. Frontend may call Modal directly later if needed |

---

## 13. Status of follow-up items

Done in the implementation passes:
- All skeletons fully implemented; frontend + mobile migrated.
- `docker-compose.yml`, `.devcontainer/docker-compose.yml`, `render.yaml`
  and `backend/Dockerfile` modernised for the new architecture (the
  retired Flask app and its Dockerfile are removed).
- CI runs the backend and Modal test suites.
- Verified: the Modal app builds against the real SDK, the Modal
  dependency set resolves, the React app builds clean, both test suites
  pass, `manage.py check` is clean.

Still operational / deferred (need production credentials or a live
environment):
- Phase 5: deploy to Modal + Vercel, run `download_models`, and the
  one-off SQLite→MongoDB user migration.
- Kubernetes / Helm / ArgoCD / per-cloud manifests still describe the old
  monolith — update them only if those deploy targets are still used.
- Load testing and the GPU/Triton flip (§7) when traffic warrants it.
