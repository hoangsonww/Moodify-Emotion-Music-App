"""Pytest bootstrap for the Modal inference service tests.

Ensures the ``modal_inference/`` directory is importable so the tests can
``import config``, ``import service``, etc. The tests deliberately avoid
importing ``modal_app`` (which needs the ``modal`` SDK) and the heavy ML
libraries -- they exercise the pure logic and the FastAPI surface.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pytest  # noqa: E402  (must come after sys.path tweak)


@pytest.fixture(autouse=True)
def _reset_caches_and_limiter():
    """Make the module-level caches + rate limiter invisible to tests.

    The Deezer search cache, the text-emotion prediction cache and the
    sliding-window rate limiter all live at module scope so they persist
    across the lifetime of a Modal container. In tests we want each case
    to start from a clean slate -- otherwise a fake response from one
    test would leak into the next, and a stray 60-request loop would
    poison every subsequent test for that user.
    """
    from inference import text_emotion as _te
    from recommendation import deezer as _dz
    from service import get_media_caches, reset_rate_limiter as _reset_limiter
    import metrics as _metrics_module
    import metrics_store as _metrics_store

    media = get_media_caches()

    def _wipe():
        for cache in (_te.get_cache(), _dz.get_cache(), *media.values()):
            cache.clear()
            cache.reset_stats()
        _reset_limiter()
        _metrics_module.reset_recorder()
        _metrics_store.reset_for_tests()

    _wipe()
    yield
    _wipe()
