import time
import hashlib
import json
import threading
from typing import Any, Optional


class TTLCache:
    """Thread-safe in-memory cache with TTL eviction. Zero dependencies."""

    def __init__(self, default_ttl: int = 300, max_size: int = 512):
        self._data: dict[str, tuple[float, Any]] = {}
        self._default_ttl = default_ttl
        self._max_size = max_size
        self._lock = threading.Lock()

    def _make_key(self, *parts: str) -> str:
        raw = ":".join(str(p) for p in parts)
        return hashlib.sha256(raw.encode()).hexdigest()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            entry = self._data.get(key)
            if entry is None:
                return None
            expires, value = entry
            if time.time() > expires:
                del self._data[key]
                return None
            return value

    def set(self, key: str, value: Any, ttl: Optional[int] = None):
        with self._lock:
            if len(self._data) >= self._max_size:
                self._evict_locked()
            expires = time.time() + (ttl if ttl is not None else self._default_ttl)
            self._data[key] = (expires, value)

    def _evict_locked(self):
        oldest = min(self._data.keys(), key=lambda k: self._data[k][0])
        del self._data[oldest]

    def invalidate(self, prefix: str):
        with self._lock:
            self._data = {k: v for k, v in self._data.items() if not k.startswith(prefix)}

    def clear(self):
        with self._lock:
            self._data.clear()

    def size(self) -> int:
        with self._lock:
            return len(self._data)


search_cache = TTLCache(default_ttl=180, max_size=256)
discover_cache = TTLCache(default_ttl=120, max_size=128)
opportunity_cache = TTLCache(default_ttl=900, max_size=512)
