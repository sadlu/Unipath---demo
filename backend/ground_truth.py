"""Zero-cost ground truth verification — checks if URLs are still alive."""

import logging
import threading
import time
from datetime import datetime, timezone
from typing import Optional

import requests

from cache import TTLCache

logger = logging.getLogger(__name__)

CHECK_TIMEOUT = 8
USER_AGENT = "Mozilla/5.0 (compatible; UniPath-Verifier/1.0)"
MAX_RETRIES = 2

verification_cache = TTLCache(default_ttl=3600, max_size=2048)

_verify_lock = threading.Lock()
_verify_queue: list[str] = []
_verify_in_progress = False


def _check_single_url(url: str) -> dict:
    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.head(
                url,
                timeout=CHECK_TIMEOUT,
                headers={"User-Agent": USER_AGENT},
                allow_redirects=True,
            )
            status = resp.status_code
            return {
                "url": url,
                "alive": 200 <= status < 400,
                "status_code": status,
                "checked_at": datetime.now(timezone.utc).isoformat(),
            }
        except requests.ConnectionError:
            try:
                resp = requests.get(
                    url,
                    timeout=CHECK_TIMEOUT,
                    headers={"User-Agent": USER_AGENT, "Range": "bytes=0-0"},
                    allow_redirects=True,
                )
                status = resp.status_code
                return {
                    "url": url,
                    "alive": 200 <= status < 400,
                    "status_code": status,
                    "checked_at": datetime.now(timezone.utc).isoformat(),
                }
            except requests.RequestException as e:
                if attempt == MAX_RETRIES - 1:
                    return {
                        "url": url,
                        "alive": False,
                        "status_code": 0,
                        "error": str(e),
                        "checked_at": datetime.now(timezone.utc).isoformat(),
                    }
                time.sleep(1)
        except requests.RequestException as e:
            if attempt == MAX_RETRIES - 1:
                return {
                    "url": url,
                    "alive": False,
                    "status_code": 0,
                    "error": str(e),
                    "checked_at": datetime.now(timezone.utc).isoformat(),
                }
            time.sleep(1)


def verify_url(url: str) -> dict:
    cached = verification_cache.get(url)
    if cached:
        return cached
    result = _check_single_url(url)
    verification_cache.set(url, result, ttl=3600)
    return result


def queue_verification(url: str):
    with _verify_lock:
        if url not in _verify_queue:
            _verify_queue.append(url)


def _batch_verify():
    global _verify_in_progress
    with _verify_lock:
        if _verify_in_progress:
            return
        _verify_in_progress = True
        batch = _verify_queue[:]
        _verify_queue.clear()

    if not batch:
        _verify_in_progress = False
        return

    logger.info(f"Verifying {len(batch)} URLs in batch...")
    threads = []
    for url in batch:
        t = threading.Thread(target=verify_url, args=(url,))
        t.start()
        threads.append(t)
    for t in threads:
        t.join()

    _verify_in_progress = False


def start_verifier_thread(interval: int = 120):
    def _loop():
        while True:
            time.sleep(interval)
            try:
                _batch_verify()
            except Exception as e:
                logger.warning(f"Verifier batch error: {e}")

    t = threading.Thread(target=_loop, daemon=True, name="url-verifier")
    t.start()
    return t
