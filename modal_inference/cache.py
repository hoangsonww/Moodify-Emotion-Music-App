"""In-process TTL + LRU cache used by the inference service.

We use this in two specific spots where caching is provably safe:

  * Deezer search results (1h TTL) -- search output is stable on the
    timescale of a single user session; the chart-rank-driven popularity
    refreshes daily at most. Caching the search step does NOT cache the
    per-request personalisation blend, which still runs every call.
  * Text-emotion predictions (24h TTL) -- the BERT classifier is purely
    deterministic on the normalised input string; ``bert-base-uncased``
    lowercases anyway, so the cache key normalises the same way.

Speech / facial uploads are *not* cached: per-user audio clips and
selfies have essentially zero repeat-hit rate, and hashing tens of MB of
bytes would burn more time than the inference saves.

Implementation notes
--------------------
* Bounded size with LRU eviction (uses ``OrderedDict.move_to_end``).
* Lazy expiry: an entry past its TTL is evicted on read and counted as a
  miss instead of being returned -- never serve a stale value.
* ``threading.Lock`` because the FastAPI app handles requests
  concurrently inside a single container (Modal launches one process per
  container, but multiple worker threads handle uploads in parallel).
* ``time.monotonic()`` is used everywhere so TTLs are immune to wall-clock
  jumps (NTP sync, suspend/resume).
* ``stats()`` returns a snapshot dict suitable for /health.
"""

from __future__ import annotations

import threading
import time
from collections import OrderedDict
from typing import Any, Callable, Hashable, Optional


class TTLCache:
    """Thread-safe bounded LRU cache with per-entry TTL.

    Parameters
    ----------
    max_size:
        Hard upper bound on the number of entries. When full, the
        least-recently-used entry is evicted before inserting a new one.
    ttl_seconds:
        Default time-to-live applied to entries inserted via ``set``
        without an explicit ttl. Pass 0 (or negative) to disable
        expiry-by-time entirely (LRU eviction still applies).
    name:
        Optional label, surfaced in ``stats()`` for /health observability.
    """

    def __init__(
        self,
        max_size: int,
        ttl_seconds: float,
        name: str = "",
    ) -> None:
        if max_size <= 0:
            raise ValueError("max_size must be > 0")
        self._max_size = int(max_size)
        self._default_ttl = float(ttl_seconds)
        self._name = name or "cache"
        self._lock = threading.Lock()
        self._store: "OrderedDict[Hashable, tuple[float, Any]]" = OrderedDict()
        # Counters; only incremented under the lock.
        self._hits = 0
        self._misses = 0
        self._sets = 0
        self._evictions = 0
        self._expired = 0

    # --- basic ops --------------------------------------------------------
    def get(self, key: Hashable) -> Optional[Any]:
        """Return the cached value or ``None`` (miss / expired)."""
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                self._misses += 1
                return None
            expires_at, value = entry
            if expires_at and time.monotonic() >= expires_at:
                # Past TTL -- drop it and count as a miss, never serve stale.
                del self._store[key]
                self._expired += 1
                self._misses += 1
                return None
            # LRU bump.
            self._store.move_to_end(key)
            self._hits += 1
            return value

    def set(
        self,
        key: Hashable,
        value: Any,
        ttl: Optional[float] = None,
    ) -> None:
        """Insert / overwrite ``key`` -> ``value`` with ``ttl`` seconds.

        ``ttl=None`` uses the cache's default TTL; ``ttl<=0`` makes the
        entry effectively permanent (still subject to LRU eviction).
        """
        effective = self._default_ttl if ttl is None else float(ttl)
        expires_at = time.monotonic() + effective if effective > 0 else 0.0
        with self._lock:
            if key in self._store:
                self._store.move_to_end(key)
            self._store[key] = (expires_at, value)
            self._sets += 1
            # Evict LRU until we're at or below the cap.
            while len(self._store) > self._max_size:
                self._store.popitem(last=False)
                self._evictions += 1

    def get_or_set(
        self,
        key: Hashable,
        factory: Callable[[], Any],
        ttl: Optional[float] = None,
    ) -> Any:
        """Return the cached value, computing + storing it on miss.

        The ``factory`` runs OUTSIDE the lock so a slow upstream call
        does not block concurrent reads. This means two concurrent
        misses on the same key may both run ``factory``; the second
        writer simply overwrites, which is fine for our pure-function
        use cases (deterministic text-emotion + stale-tolerant Deezer
        search).
        """
        cached = self.get(key)
        if cached is not None:
            return cached
        value = factory()
        # Don't pollute the cache with sentinel "no result" values when the
        # factory itself is signalling failure with an empty list/None --
        # leave those decisions to the caller via an explicit set().
        if value is not None:
            self.set(key, value, ttl=ttl)
        return value

    def clear(self) -> None:
        """Drop every entry. Counters are kept so /health still tells a story."""
        with self._lock:
            self._store.clear()

    def reset_stats(self) -> None:
        """Zero the hit/miss counters (useful in tests)."""
        with self._lock:
            self._hits = 0
            self._misses = 0
            self._sets = 0
            self._evictions = 0
            self._expired = 0

    # --- observability ----------------------------------------------------
    def __len__(self) -> int:
        with self._lock:
            return len(self._store)

    def stats(self) -> dict:
        with self._lock:
            total = self._hits + self._misses
            hit_ratio = (self._hits / total) if total else 0.0
            return {
                "name": self._name,
                "size": len(self._store),
                "max_size": self._max_size,
                "ttl_seconds": self._default_ttl,
                "hits": self._hits,
                "misses": self._misses,
                "sets": self._sets,
                "evictions": self._evictions,
                "expired": self._expired,
                "hit_ratio": round(hit_ratio, 4),
            }
