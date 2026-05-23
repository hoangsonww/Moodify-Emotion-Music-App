"""Sliding-window rate limiter for the inference endpoints.

This is *user-experience-first* throttling: the goal is to keep a single
runaway client from draining the Modal compute budget, NOT to ratchet a
real person down for normal use. The default ceiling (60 requests per
60-second window per caller) is generous enough that a human pressing
buttons in the UI will never hit it -- yet low enough that a stuck
front-end loop or a script will trip it within seconds.

Design choices
--------------
* **Sliding window of timestamps** (not fixed buckets) so the limit can't
  be doubled at the bucket boundary -- 60 in the last second + 60 in the
  next second would be 120 requests across ~2s with a naive bucket.
* **Per-caller key**:
    - JWT-authed user -> the JWT ``sub`` claim (one user, all their tabs)
    - Service token   -> SKIPPED entirely. Django proxy calls already go
      through DRF throttling (60/min anon, 240/min authed) so re-limiting
      them at the Modal edge would amplify a single user's window down to
      whatever Django sent through.
* **No background sweeper**: stale per-caller deques are pruned lazily
  on the next `check()` for that key, and an LRU bound on the dict caps
  memory regardless. Modal containers are short-lived anyway.
* **Retry-After header** is set when blocking so the client can back off
  intelligently rather than spinning.
* **Monotonic clock** so suspends / NTP jumps don't blow a window.
"""

from __future__ import annotations

import threading
import time
from collections import OrderedDict, deque
from typing import Optional


class RateLimitDecision:
    """Result of a ``check`` call -- whether to allow, and when to retry."""

    __slots__ = ("allowed", "retry_after", "current", "limit", "window")

    def __init__(
        self,
        allowed: bool,
        retry_after: float,
        current: int,
        limit: int,
        window: float,
    ) -> None:
        self.allowed = allowed
        # Seconds the client should wait before retrying. 0 on allow.
        self.retry_after = retry_after
        # How many requests this caller has in the current window
        # (counts THIS one if it was allowed).
        self.current = current
        self.limit = limit
        self.window = window

    def as_headers(self) -> dict[str, str]:
        """Standard rate-limit response headers (allow + deny cases)."""
        remaining = max(0, self.limit - self.current)
        headers = {
            "X-RateLimit-Limit": str(self.limit),
            "X-RateLimit-Remaining": str(remaining),
            "X-RateLimit-Window": str(int(self.window)),
        }
        if not self.allowed:
            # Round up so the client doesn't retry a hair too early and
            # bounce off the limit again.
            headers["Retry-After"] = str(max(1, int(self.retry_after + 0.999)))
        return headers


class SlidingWindowLimiter:
    """Sliding-window per-key rate limiter, in-process.

    Parameters
    ----------
    limit:
        Max requests permitted in ``window`` seconds per caller key.
    window:
        Window length in seconds.
    max_keys:
        Cap on the number of distinct caller keys tracked at once. Once
        full, the least-recently-seen key is evicted -- which is the
        safe choice (a returning caller starts with an empty window
        rather than carrying a stale near-limit count).
    """

    def __init__(self, limit: int, window: float, max_keys: int = 10_000) -> None:
        if limit <= 0:
            raise ValueError("limit must be > 0")
        if window <= 0:
            raise ValueError("window must be > 0")
        if max_keys <= 0:
            raise ValueError("max_keys must be > 0")
        self._limit = int(limit)
        self._window = float(window)
        self._max_keys = int(max_keys)
        self._lock = threading.Lock()
        self._buckets: "OrderedDict[str, deque[float]]" = OrderedDict()
        # Counters for observability via /health.
        self._allowed = 0
        self._blocked = 0

    @property
    def limit(self) -> int:
        return self._limit

    @property
    def window(self) -> float:
        return self._window

    def check(self, key: str) -> RateLimitDecision:
        """Record a request for ``key`` and decide whether to allow it."""
        now = time.monotonic()
        cutoff = now - self._window
        with self._lock:
            bucket = self._buckets.get(key)
            if bucket is None:
                bucket = deque()
                self._buckets[key] = bucket
            else:
                # Touch the LRU.
                self._buckets.move_to_end(key)

            # Drop expired timestamps.
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()

            if len(bucket) >= self._limit:
                # The oldest in-window timestamp tells us exactly when the
                # window will next slide forward enough to admit a request.
                retry_after = bucket[0] - cutoff
                self._blocked += 1
                # Don't drop empty trailing buckets here; the caller will
                # be back shortly and we'd just re-allocate.
                return RateLimitDecision(
                    allowed=False,
                    retry_after=max(0.0, retry_after),
                    current=len(bucket),
                    limit=self._limit,
                    window=self._window,
                )

            bucket.append(now)
            self._allowed += 1
            # LRU bound on key set; evict the oldest if we just grew.
            while len(self._buckets) > self._max_keys:
                self._buckets.popitem(last=False)
            return RateLimitDecision(
                allowed=True,
                retry_after=0.0,
                current=len(bucket),
                limit=self._limit,
                window=self._window,
            )

    def clear(self) -> None:
        """Drop all tracked buckets (used in tests)."""
        with self._lock:
            self._buckets.clear()

    def reset_stats(self) -> None:
        with self._lock:
            self._allowed = 0
            self._blocked = 0

    def stats(self) -> dict:
        with self._lock:
            total = self._allowed + self._blocked
            block_ratio = (self._blocked / total) if total else 0.0
            return {
                "limit": self._limit,
                "window_seconds": self._window,
                "tracked_keys": len(self._buckets),
                "max_keys": self._max_keys,
                "allowed": self._allowed,
                "blocked": self._blocked,
                "block_ratio": round(block_ratio, 4),
            }


def caller_key(ctx: dict) -> Optional[str]:
    """Build a stable per-caller key from an ``auth.authenticate`` ctx.

    Returns ``None`` for service-token callers, which means "do not
    rate-limit" -- those are trusted Django -> Modal proxy hops, already
    DRF-throttled per-user upstream.
    """
    if not ctx:
        return None
    if ctx.get("kind") == "service":
        return None
    claims = ctx.get("claims") or {}
    sub = claims.get("sub") or claims.get("user_id")
    if sub:
        return f"user:{sub}"
    # Authenticated but anonymous claims -- unusual, but key on a stable
    # hash of the whole claim set so a token still groups its own calls.
    return f"jwt:{hash(tuple(sorted(claims.items())))}"
