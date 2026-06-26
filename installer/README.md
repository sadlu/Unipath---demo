# UniPath Windows Installer

## Prerequisites (for building)

- Windows 10/11
- [Inno Setup 6+](https://jrsoftware.org/isdl.php)
- Node.js 20+
- Python 3.10+
- PyInstaller (`pip install pyinstaller`)

## How to Build

```cmd
cd installer
build-installer.bat
```

This will:
1. Build the frontend (Vite + React)
2. Build the Electron main process
3. Build the backend with PyInstaller
4. Package with electron-builder
5. Compile the Inno Setup installer

Output: `dist-installer\UniPath-Setup-X.X.X.exe`

## How the Installer Works

1. User downloads `UniPath-Setup-X.X.X.exe`
2. Double-click to run (admin may be required)
3. VC++ Redistributable is checked and auto-installed if missing
4. Files are extracted to `%ProgramFiles%\UniPath`
5. Firewall rule is added for the backend
6. Desktop/Start Menu shortcuts are created
7. App launches automatically after install (optional)

## What's Included

| Component | Source | Destination |
|-----------|--------|-------------|
| Electron App | `dist-setup/` | `{app}\` |
| Backend Binary | `dist-backend/unipath-backend.exe` | `{app}\backend-bin\` |
| Launcher | `scripts/unipath-launcher.bat` | `{app}\` |
| Port Detector | `scripts/unipath-port-detect.ps1` | `{app}\` |

## How the App Runs

The launcher (`unipath-launcher.bat`) handles:
1. Port detection (finds a free port starting from 8000)
2. Backend startup (runs `unipath-backend.exe` as a background process)
3. Health check (waits for `/api/health` to respond)
4. Electron launch
5. Cleanup (kills backend when the app closes)

## CI/CD

The GitHub Actions workflow at `.github/workflows/release.yml` handles building
on all three platforms. The Windows job uses `npm run dist:win` which produces
an NSIS installer via electron-builder.
