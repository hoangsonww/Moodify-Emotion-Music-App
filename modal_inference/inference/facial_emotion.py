"""Facial emotion inference -- PyTorch model + OpenCV preprocessing.

Refactored from ai_ml/src/models/facial_emotion.py.

VERIFICATION ITEM (plan §4.2 / §12): the legacy code does
``model = torch.load(path)`` then ``model.top_emotion(image)``. The
``.top_emotion()`` method belongs to the `fer` library's FER class. Before
finalizing requirements.txt, confirm what the .pt actually deserializes to
and pin exactly one of: fer / facenet-pytorch / (none, plain nn.Module).
"""

import logging

import config

logger = logging.getLogger(__name__)


class FacialInferenceResult:
    """Result of a facial inference: emotion + whether a fallback was used."""

    def __init__(self, emotion: str, degraded: bool = False) -> None:
        self.emotion = emotion
        self.degraded = degraded


class FacialEmotionModel:
    """Loads the facial emotion model once, then infers."""

    def __init__(self) -> None:
        self._model = None

    @property
    def loaded(self) -> bool:
        return self._model is not None

    def load(self) -> None:
        """Load the .pt model from the mounted Modal Volume."""
        import torch

        logger.info("Loading facial emotion model from %s", config.FACIAL_MODEL_PATH)
        # TODO(impl): confirm map_location / weights_only and the wrapper
        # type once the facial-model dependency is verified.
        self._model = torch.load(config.FACIAL_MODEL_PATH, map_location="cpu")

    def predict(self, image_path: str) -> FacialInferenceResult:
        """Infer emotion from an image file path.

        TODO(impl):
          * read + preprocess the image with OpenCV (see legacy
            preprocess_image: resize 48x48, normalize, channel handling);
          * run the model (legacy calls model.top_emotion(image));
          * on failure log it and return FacialInferenceResult(
            emotion=<neutral default>, degraded=True) -- never a silent
            random emotion.
        """
        raise NotImplementedError("TODO(impl): port from ai_ml/src/models/facial_emotion.py")
