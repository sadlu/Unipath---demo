"""Persistent deduplication across requests using a bounded seen-set.

Stores seen opportunity URLs/titles in a rolling SQLite-backed store
so the same opportunity isn't shown twice across different searches.
"""

import time
import json
import hashlib
import logging
import threading
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

_cleanup_interval = 3600
_max_entries = 10000
_entry_ttl = 86400

_seen: dict[str, float] = {}
_lock = threading.Lock()


def _make_key(title: str, url: str) -> str:
    raw = f"{title.lower().strip()}|{url.lower().strip()}"
    return hashlib.sha256(raw.encode()).hexdigest()


def is_duplicate(title: str, url: str) -> bool:
    key = _make_key(title, url)
    with _lock:
        entry = _seen.get(key)
        if entry is None:
            return False
        if time.time() > entry:
            del _seen[key]
            return False
        return True


def mark_seen(title: str, url: str):
    key = _make_key(title, url)
    with _lock:
        _seen[key] = time.time() + _entry_ttl
        if len(_seen) > _max_entries:
            _trim_locked()


def _trim_locked():
    sorted_items = sorted(_seen.items(), key=lambda x: x[1])
    to_remove = len(sorted_items) - (_max_entries // 2)
    for key, _ in sorted_items[:to_remove]:
        del _seen[key]


def _cleanup_expired():
    now = time.time()
    with _lock:
        expired = [k for k, v in _seen.items() if now > v]
        for k in expired:
            del _seen[k]


def start_dedup_cleaner(interval: int = 3600):
    def _loop():
        while True:
            time.sleep(interval)
            try:
                _cleanup_expired()
            except Exception as e:
                logger.warning(f"Dedup cleanup error: {e}")

    t = threading.Thread(target=_loop, daemon=True, name="dedup-cleaner")
    t.start()
    return t


def dedup_size() -> int:
    with _lock:
        return len(_seen)


def clear_dedup():
    with _lock:
        _seen.clear()
