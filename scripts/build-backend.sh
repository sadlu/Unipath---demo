#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

APP_NAME="unipath-backend"
BUILD_DIR="dist-backend"
ENTRY_POINT="backend/server.py"

echo "==> Installing PyInstaller..."
pip install pyinstaller > /dev/null 2>&1

echo "==> Building $APP_NAME with PyInstaller..."
pyinstaller \
  --onefile \
  --name "$APP_NAME" \
  --distpath "$BUILD_DIR" \
  --workpath /tmp/pyinstaller-build \
  --specpath /tmp/pyinstaller-spec \
  --add-data "backend/config.py:backend" \
  --add-data "backend/database.py:backend" \
  --add-data "backend/search_service.py:backend" \
  --add-data "backend/llm_service.py:backend" \
  --add-data "backend/pipeline.py:backend" \
  --add-data "backend/local_index.py:backend" \
  --add-data "backend/email_service.py:backend" \
  --add-data "backend/__init__.py:backend" \
  --add-data "backend/main.py:backend" \
  --hidden-import uvicorn \
  --hidden-import uvicorn.logging \
  --hidden-import uvicorn.loops.auto \
  --hidden-import uvicorn.protocols.http.auto \
  --hidden-import uvicorn.protocols.websockets.auto \
  --hidden-import fastapi \
  --hidden-import pydantic \
  --hidden-import dotenv \
  --hidden-import duckduckgo_search \
  --hidden-import requests \
  --hidden-import bs4 \
  --hidden-import openai \
  --hidden-import lxml \
  --hidden-import httpx \
  --hidden-import httpcore \
  --hidden-import anyio \
  --hidden-import sniffio \
  --hidden-import h11 \
  --hidden-import starlette \
  --hidden-import starlette.applications \
  --hidden-import multidict \
  --hidden-import yarl \
  --hidden-import aiohttp \
  --collect-all uvicorn \
  --collect-all fastapi \
  --collect-all starlette \
  "$ENTRY_POINT"

echo "==> Done! Binary at: $BUILD_DIR/$APP_NAME"

# Clean up PyInstaller temp files
rm -rf /tmp/pyinstaller-build /tmp/pyinstaller-spec "$ENTRY_POINT.spec" 2>/dev/null || true

ls -lh "$BUILD_DIR/$APP_NAME"*
