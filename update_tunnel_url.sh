#!/usr/bin/env bash
set -e
URL="${1:-$(cat "$(cd "$(dirname "$0")" && pwd)/public_url.txt" 2>/dev/null)}"
[ -z "$URL" ] && echo "No URL" && exit 1
[ -z "$CF_ACCOUNT_ID$CF_KV_NAMESPACE_ID$CF_API_TOKEN" ] && echo "Set CF_ACCOUNT_ID, CF_KV_NAMESPACE_ID, CF_API_TOKEN" && exit 1
curl -s -X PUT "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/storage/kv/namespaces/$CF_KV_NAMESPACE_ID/values/current" \
  -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: text/plain" -d "$URL" > /dev/null
echo "KV updated: $URL"
