# UniPath — Installation Guide

## Quick start (recommended)

### Option A — Pre-built setup executable

Download the latest `UniPath-Setup.exe` (Windows), `UniPath-Setup-Linux`, or
`UniPath-Setup-Mac` from the
[Releases page](https://github.com/sadlu/Unipath---demo/releases).

Run the file — it checks for everything, asks before downloading anything,
and sets up the full app automatically.

### Option B — From source

Requires [Git](https://git-scm.com/), [Node.js 18+](https://nodejs.org/),
and [Python 3.10+](https://www.python.org/).

```bash
git clone https://github.com/sadlu/Unipath---demo.git
cd Unipath---demo
node bootstrap.js
```

The script detects what's missing, offers to download prerequisites, then
installs dependencies and builds the app.

### Option C — Manual steps

```
npm install
cd backend
python3 -m venv .venv
source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cd ..
npm run build
npm run dev
```

---

## Building the setup executable yourself

```bash
npm install -g pkg
pkg bootstrap.js --targets node16-win-x64   --output UniPath-Setup.exe
pkg bootstrap.js --targets node16-linux-x64 --output UniPath-Setup-Linux
pkg bootstrap.js --targets node16-macos-x64 --output UniPath-Setup-Mac
```

---

## Email verification (optional)

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your SMTP credentials (Gmail App Password recommended).
Without this the app runs fine but email verification is unavailable.

---

## Project structure

```
Unipath---demo/
├── backend/              # Python FastAPI server
├── bootstrap.js          # Cross-platform setup script
├── electron/             # Electron main process
├── src/                  # React frontend
├── setup.sh              # Legacy setup (Linux/macOS)
├── setup.bat             # Legacy setup (Windows)
├── INSTALL.md
└── README.md
```

---

## Common issues

- **"python3 not found" on Windows** — use `python` instead, or rename
- **Port 8000 in use** — change the port in `backend/config.py`
- **Backend not starting** — make sure the venv exists and deps are installed
