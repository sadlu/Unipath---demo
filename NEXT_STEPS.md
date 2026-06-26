# UniPath - Next Steps

## Current Status

### Working
- Backend running on port 8080 ✓
- APK v2.1.0 built and on GitHub Releases ✓
- Mobile GUI remodel done (full-width, bottom sheets, touch targets) ✓

### Still Broken
- **Cloudflare worker** (`unipath-proxy.fouadazad1234.workers.dev`) proxies to an old ngrok URL
  - KV entry "current" needs updating with a fresh tunnel URL
  - Phone apps using the default permanent URL will get a 404

## To Fix Permanently

### Set Cloudflare credentials (recommended)
Set these env vars, then run `start_server.sh`:
```
export CF_ACCOUNT_ID=your_account_id
export CF_KV_NAMESPACE_ID=your_namespace_id
export CF_API_TOKEN=your_token
bash start_server.sh
```
This updates the KV store with the new ngrok URL, and the permanent URL on the phone works.

## Build Commands
```bash
npx vite build           # Build web assets
npx cap sync android     # Sync plugins and copy to Android
cd android && ./gradlew assembleDebug  # Build APK
```

## Release
```bash
gh release create "vX.Y.Z" --title "..." --notes "..." ./android/app/build/outputs/apk/debug/app-debug.apk#UniPath-vX.Y.Z-android.apk
```
