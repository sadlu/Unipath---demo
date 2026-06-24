# UniPath - Next Steps

## Current Status (June 24)

### Working
- Backend running on port 8000 ✓
- ngrok tunnel active at URL below ✓
- APK v2.1.0 built and on GitHub Releases ✓
- Mobile GUI remodel done (full-width, bottom sheets, touch targets) ✓

### Still Broken
- **Cloudflare worker** (`unipath-proxy.fouadazad1234.workers.dev`) proxies to a **dead ngrok URL**
  - KV entry "current" has old URL: `0f1d-110-44-116-125.ngrok-free.app` (offline)
  - Phone apps using the default permanent URL will get a 404

## To Fix Permanently

### Option A — Set Cloudflare credentials (recommended)
Set these env vars, then run `start_server.sh`:
```
export CF_ACCOUNT_ID=your_account_id
export CF_KV_NAMESPACE_ID=your_namespace_id
export CF_API_TOKEN=your_token
bash start_server.sh
```
This updates the KV store with the new ngrok URL, and the permanent URL on the phone works.

### Option B — Enter URL manually on phone (quick fix)
Current live ngrok URL (changes if ngrok restarts):
```
https://396b-2405-acc0-1207-1123-72e3-a8f-7540-b765.ngrok-free.app
```
Enter this in Settings → Server Connection → Save → Test Connection.

## Build Commands
```bash
npx vite build           # Build web assets
npx cap copy android     # Copy to Android
npx cap sync android     # Sync plugins
cd android && ./gradlew assembleDebug  # Build APK
```

## Release
```bash
gh release create "vX.Y.Z" --title "..." --notes "..." ./android/app/build/outputs/apk/debug/app-debug.apk#UniPath-vX.Y.Z-android.apk
```

### Previous login & auth work (already done - no changes needed)
- Dynamic `getApiBase()` in `api.ts` — reads from localStorage → env var → Cloudflare worker → localhost
- Server URL setting in Settings page
- All API calls use runtime URL, not build-time constant
