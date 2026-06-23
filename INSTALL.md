# UniPath — Installation Guide

## Quick start (recommended)

### Linux / macOS

```bash
git clone https://github.com/sadlu/Unipath---demo.git
cd Unipath---demo
chmod +x setup.sh
./setup.sh
```

The script checks for Node.js 18+, npm, and Python 3.10+. If anything is
missing it asks before installing, then sets up everything automatically.

### Windows

Double-click `setup.bat` or run in Command Prompt:

```cmd
git clone https://github.com/sadlu/Unipath---demo.git
cd Unipath---demo
setup.bat
```

---

## Manual setup

| Dependency | Minimum version |
|---|---|
| Node.js | 18 |
| npm | 9 |
| Python | 3.10 |

### Frontend

```
npm install
npm run build
```

### Backend

**Linux / macOS**
```
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

**Windows**
```
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

### Run

```
npm run dev
```

---

## Email verification (optional)

To enable real email verification, copy the example config and fill in your
SMTP credentials:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your SMTP details (Gmail App Password recommended).
Without this, the app runs fine but email verification will be unavailable.

---

## Project structure

```
Unipath---demo/
├── backend/              # Python FastAPI server
│   ├── main.py           # API endpoints
│   ├── database.py       # SQLite models & queries
│   ├── email_service.py  # SMTP email sending
│   ├── search_service.py # DuckDuckGo search
│   ├── config.py         # Settings from env
│   └── requirements.txt  # Python dependencies
├── electron/             # Electron main process
│   ├── main.ts           # Window creation & backend spawn
│   └── preload.ts        # Context bridge
├── src/                  # React frontend
│   ├── App.tsx           # Root component & routing
│   ├── pages/            # View components
│   ├── components/       # Shared components
│   ├── store/            # Zustand state
│   └── services/         # API client
├── setup.sh              # Linux/macOS automated setup
├── setup.bat             # Windows automated setup
├── package.json
├── INSTALL.md
└── README.md
```

---

## Common issues

- **"python3 not found" on Windows** — use `python` instead
- **Port 8000 in use** — kill the existing process or change the port in `backend/config.py`
- **Backend not starting** — make sure the venv exists and deps are installed
