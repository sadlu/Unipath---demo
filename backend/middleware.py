import time
import logging
from collections import defaultdict
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, default_max: int = 120, window_seconds: int = 10):
        super().__init__(app)
        self.default_max = default_max
        self.window = window_seconds
        self._path_limits: dict[str, int] = {
            "/api/health": 60,
            "/api/search": 15,
            "/api/chat": 15,
            "/api/discover": 10,
            "/api/cv/advise": 10,
            "/api/chat/send": 30,
            "/api/feedback": 30,
            "/api/auth/login": 10,
            "/api/auth/register": 5,
        }
        self._hits: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path

        limit = self._find_limit(path)
        if limit is not None:
            client_ip = self._get_client_ip(request)
            now = time.time()
            key = f"{client_ip}:{path}"

            hit_list = self._hits.get(key, [])
            hit_list = [t for t in hit_list if now - t < self.window]

            if len(hit_list) >= limit:
                logger.info(f"Rate limit hit: {key} ({limit}/{self.window}s)")
                return Response(
                    content='{"error": "Rate limit exceeded. Please wait before making more requests."}',
                    status_code=429,
                    media_type="application/json",
                    headers={"Retry-After": str(self.window)},
                )

            hit_list.append(now)
            self._hits[key] = hit_list

        return await call_next(request)

    def _get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For", "")
        if forwarded:
            return forwarded.split(",")[0].strip()
        real_ip = request.headers.get("X-Real-IP", "")
        if real_ip:
            return real_ip
        client = request.client
        if client:
            return client.host
        return "127.0.0.1"

    def _find_limit(self, path: str):
        if not path.startswith("/api/"):
            return None
        for prefix, max_calls in self._path_limits.items():
            if path.startswith(prefix):
                return max_calls
        return self.default_max
