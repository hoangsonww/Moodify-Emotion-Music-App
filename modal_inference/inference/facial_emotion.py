"""Facial emotion inference -- the FER library's pretrained detector.

Refactored from ai_ml/src/models/facial_emotion.py.

The legacy ``trained_facial_emotion_model.pt`` was simply a pickled
``fer.FER(mtcnn=True)`` instance (see
ai_ml/src/models/train_facial_emotion_model.py) -- not a custom-trained
model. Re-pickling a FER object (which wraps Keras models) through
``torch.save`` is fragile, so this service constructs the detector directly
from the ``fer`` package's bundled weights. This removes the weight
download entirely and is far more robust.
"""

import logging

import config

logger = logging.getLogger(__name__)

# FER emits Ekman labels; normalise them to Moodify's emotion vocabulary.
_FER_LABEL_MAP = {
    "angry": "anger",
    "disgust": "disgust",
    "fear": "fear",
    "happy": "joy",
    "sad": "sadness",
    "surprise": "surprised",
    "neutral": "neutral",
}


class FacialInferenceResult:
    """Result of a facial inference."""

    def __init__(self, emotion: str, degraded: bool = False) -> None:
        self.emotion = emotion
        self.degraded = degraded


class FacialEmotionModel:
    """Builds the FER detector once, then infers."""

    def __init__(self) -> None:
        self._model = None

    @property
    def loaded(self) -> bool:
        return self._model is not None

    def load(self) -> None:
        """Construct the FER detector from the library's bundled weights."""
        from fer import FER

        logger.info("Initialising FER facial emotion detector (mtcnn=True)")
        self._model = FER(mtcnn=True)

    def predict(self, image_path: str) -> FacialInferenceResult:
        """Infer the dominant facial emotion from an image file path."""
        if not self.loaded:
            raise RuntimeError("FacialEmotionModel.load() was not called")

        try:
            import cv2

            image = cv2.imread(image_path)
            if image is None:
                raise ValueError("unreadable or corrupt image")

            emotion, score = self._model.top_emotion(image)
            if not emotion or score is None:
                logger.info("No face / emotion detected in image")
                return FacialInferenceResult(emotion=config.DEFAULT_EMOTION, degraded=True)

            return FacialInferenceResult(emotion=_FER_LABEL_MAP.get(emotion.lower(), emotion.lower()))
        except Exception:  # noqa: BLE001 -- degrade gracefully, never 500
            logger.exception("Facial emotion inference failed for %s", image_path)
            return FacialInferenceResult(emotion=config.DEFAULT_EMOTION, degraded=True)
