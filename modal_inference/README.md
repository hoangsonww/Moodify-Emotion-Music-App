# Moodify ML Inference Service (Modal)

Standalone ML inference service for Moodify, deployed on
[Modal](https://modal.com). It replaces in-process Django inference and the
legacy Flask app (`ai_ml/src/api/emotion_api.py`).

See [`docs/PRODUCTION_REFACTOR_PLAN.md`](../docs/PRODUCTION_REFACTOR_PLAN.md)
for the full architecture. The service is fully implemented; the only
deploy-time step is running `download_models` once (see below).

## Layout

```
modal_app.py        Modal App: image, Volume, InferenceService, FastAPI app
config.py           env + model paths
auth.py             JWT + service-token verification
schemas.py          Pydantic request/response models
download_models.py  fetches model weights into the Modal Volume
inference/          one load-once class per model
recommendation/     Spotify client + token cache
requirements.txt    CPU dependencies   (requirements-gpu.txt = NVIDIA path)
```

## Endpoints

| Method | Path                   | Auth | Body |
|--------|------------------------|------|------|
| GET    | `/health`              | none | — |
| POST   | `/text_emotion`        | yes  | `{"text": "..."}` |
| POST   | `/speech_emotion`      | yes  | multipart `file` |
| POST   | `/facial_emotion`      | yes  | multipart `file` |
| POST   | `/music_recommendation`| yes  | `{"emotion": "...", "market": "..."}` |

All return `{"emotion", "recommendations", "degraded", "market"}`.
`Authorization: Bearer <token>` accepts an end-user JWT (browser → Modal)
or the `MODAL_SERVICE_TOKEN` (Django → Modal proxy).

## Setup

Requires Modal CLI ≥ 1.0 (`min_containers` / `scaledown_window`). Run all
commands from this directory.

```bash
pip install modal
modal token new

# One-time secret (see .env.example for the full list)
modal secret create moodify-secrets \
  SPOTIFY_CLIENT_ID=...  SPOTIFY_CLIENT_SECRET=... \
  JWT_SIGNING_KEY=...    MODAL_SERVICE_TOKEN=... \
  ALLOWED_ORIGINS=https://your-frontend.example

# One-time: download model weights into the Modal Volume
modal run modal_app.py::download_models

# Develop locally / deploy
modal serve modal_app.py
modal deploy modal_app.py
```

After deploy, set `MODAL_INFERENCE_URL` in the Django/Vercel environment to
the printed service URL.

## NVIDIA GPU path

CPU + keep-warm is the default. To move to NVIDIA GPU: add `gpu="T4"` to the
`@app.cls` decorator in `modal_app.py` and build the image from
`requirements-gpu.txt` with the CUDA PyTorch index. See plan §7 for the
flip trigger and the TensorRT / Triton assessment.
