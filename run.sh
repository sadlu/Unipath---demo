#!/usr/bin/env bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Node ──
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

cd "$DIR"

# ── Rebuild if needed ──
if [ ! -f "dist/index.html" ] || [ ! -f "dist-electron/main.js" ]; then
  echo "[UniPath] Building..."
  npx vite build 2>&1 | tail -3
fi

# ── Launch ──
exec npx electron . --no-sandbox
