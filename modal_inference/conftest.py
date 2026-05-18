"""Pytest bootstrap for the Modal inference service tests.

Ensures the ``modal_inference/`` directory is importable so the tests can
``import config``, ``import service``, etc. The tests deliberately avoid
importing ``modal_app`` (which needs the ``modal`` SDK) and the heavy ML
libraries -- they exercise the pure logic and the FastAPI surface.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
