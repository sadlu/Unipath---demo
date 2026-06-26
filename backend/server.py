from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import settings
from main import app
import uvicorn

if __name__ == "__main__":
    uvicorn.run(app, host=settings.server_host, port=settings.server_port, log_level="info")
