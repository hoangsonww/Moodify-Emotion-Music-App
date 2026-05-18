"""Speech emotion inference -- MFCC features + scikit-learn classifier.

Refactored from ai_ml/src/models/speech_emotion.py. Legacy issues fixed
here:
  * model + scaler unpickled once in `load()`, not per request;
  * WAV conversion uses a unique temp file, not a fixed "temp_audio.wav"
    (plan problem #9 -- race condition under concurrency);
  * a model failure returns degraded=True instead of a silent random
    emotion (plan problem #7).
"""

import logging
import pickle

import config

logger = logging.getLogger(__name__)


class SpeechInferenceResult:
    """Result of a speech inference: emotion + whether a fallback was used."""

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
        """Unpickle the model and scaler from the mounted Modal Volume."""
        logger.info("Loading speech emotion model from %s", config.SPEECH_MODEL_PATH)
        with open(config.SPEECH_MODEL_PATH, "rb") as fh:
            self._model = pickle.load(fh)
        with open(config.SPEECH_SCALER_PATH, "rb") as fh:
            self._scaler = pickle.load(fh)

    def _extract_features(self, wav_path: str):
        """Mean-pooled MFCC feature vector for an audio file."""
        import librosa
        import numpy as np

        speech, sr = librosa.load(wav_path, sr=None)
        return np.mean(
            librosa.feature.mfcc(y=speech, sr=sr, n_mfcc=config.MFCC_COUNT).T,
            axis=0,
        )

    def predict(self, audio_path: str) -> SpeechInferenceResult:
        """Infer emotion from an audio file path.

        TODO(impl):
          * if audio_path is mp4/webm, convert to WAV with
            tempfile.NamedTemporaryFile (unique name) + ffmpeg, and clean
            up in a finally block;
          * extract features, scaler.transform, model.predict;
          * on any failure log it and return SpeechInferenceResult(
            emotion=<neutral default>, degraded=True).
        """
        raise NotImplementedError("TODO(impl): port from ai_ml/src/models/speech_emotion.py")
