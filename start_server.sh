#!/usr/bin/env bash
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
pkill -f "uvicorn.*backend.main" 2>/dev/null; pkill -f ngrok 2>/dev/null; sleep 1
cd "$DIR"
UVICORN=".venv/bin/uvicorn"
[ -f "$UVICORN" ] || UVICORN="python -m uvicorn"
nohup $UVICORN backend.main:app --host 0.0.0.0 --port 8000 > /tmp/unipath_backend.log 2>&1 &
npx -y ngrok http 8000 --log=stdout > /tmp/unipath_ngrok.log 2>&1 &
echo -n "Waiting for tunnel"
for i in $(seq 1 30); do
  sleep 1; echo -n "."
  URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | python3 -c "import sys,json;d=json.load(sys.stdin);print(next((t['public_url'] for t in d['tunnels'] if 'https' in t['public_url']),''))" 2>/dev/null)
  if [ -n "$URL" ]; then
    echo "$URL" > "$DIR/public_url.txt"
    if [ -n "${CF_ACCOUNT_ID:-}" ] && [ -n "${CF_KV_NAMESPACE_ID:-}" ] && [ -n "${CF_API_TOKEN:-}" ]; then
      curl -s -X PUT "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/storage/kv/namespaces/$CF_KV_NAMESPACE_ID/values/current" -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: text/plain" -d "$URL" > /dev/null
      echo ""; echo "Cloudflare KV updated!"
    fi
    echo ""; echo "=== UniPath LIVE at: $URL ==="
    echo "Permanent: https://unipath-proxy.fouadazad1234.workers.dev"
    wait; exit 0
  fi
done
echo "Timed out"; exit 1
