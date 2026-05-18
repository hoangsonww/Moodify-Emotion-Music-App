"""Inference modules for the Moodify Modal service.

Each model is a class loaded ONCE per container (via the Modal
``@modal.enter()`` lifecycle hook) and reused across requests -- the core
fix for the legacy per-request model reloading.
"""
