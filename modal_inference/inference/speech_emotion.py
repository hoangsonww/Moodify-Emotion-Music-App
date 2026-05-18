"""Speech emotion inference -- MFCC features + scikit-learn classifier.

Refactored from ai_ml/src/models/speech_emotion.py. Legacy issues fixed:
  * model + scaler are unpickled once in ``load()``, not per request;
  * any audio container (wav / webm / mp4 / mp3) is read directly by
    librosa via its ffmpeg backend -- no fixed-name temp file, so there is
    no concurrency race;
  * a model failure returns ``degraded=True`` with a neutral emotion
    instead of silently returning a random one.
"""

import logging
import pickle

import config

logger = logging.getLogger(__name__)


class SpeechInferenceResult:
    """Result of a speech inference."""

    def __init__(self, emotion: str, degraded: bool = False) -> None:
        self.emotion = emotion
        self.degraded = degraded


class SpeechEmotionModel:
    """Loads the sklearn speech model + scaler once, then infers."""

    def __init__(self) -> None:
        self._model = None
        self._scaler = None

    @property
    def loaded(self) -> bool:
        return self._model is not None and self._scaler is not None

    def load(self) -> None:
        """Unpickle the model and scaler from the bundled assets."""
        logger.info("Loading speech emotion model from %s", config.SPEECH_MODEL_PATH)
        with open(config.SPEECH_MODEL_PATH, "rb") as fh:
            self._model = pickle.load(fh)
        with open(config.SPEECH_SCALER_PATH, "rb") as fh:
            self._scaler = pickle.load(fh)

    def _extract_features(self, audio_path: str):
        """Return a mean-pooled MFCC feature vector for an audio file."""
        import librosa
        import numpy as np

        # librosa uses soundfile, then falls back to its audioread/ffmpeg
        # backend, so wav / mp3 / mp4 / webm all load with one call.
        speech, sample_rate = librosa.load(audio_path, sr=None)
        if speech is None or len(speech) == 0:
            raise ValueError("empty or unreadable audio")
        mfccs = librosa.feature.mfcc(y=speech, sr=sample_rate, n_mfcc=config.MFCC_COUNT)
        return np.mean(mfccs.T, axis=0)

    def predict(self, audio_path: str) -> SpeechInferenceResult:
        """Infer the emotion from an audio file path."""
        if not self.loaded:
            raise RuntimeError("SpeechEmotionModel.load() was not called")

        try:
            features = self._extract_features(audio_path)
            scaled = self._scaler.transform(features.reshape(1, -1))
            prediction = self._model.predict(scaled)
            if prediction is not None and len(prediction) and prediction[0]:
                return SpeechInferenceResult(emotion=str(prediction[0]).lower())
            raise ValueError("model returned an empty prediction")
        except Exception:  # noqa: BLE001 -- degrade gracefully, never 500
            logger.exception("Speech emotion inference failed for %s", audio_path)
            return SpeechInferenceResult(emotion=config.DEFAULT_EMOTION, degraded=True)
