# UniPath — Installation Guide

## Prerequisites

| Dependency | Version | Check command |
|---|---|---|
| Node.js | >= 18 | `node -v` |
| npm | >= 9 | `npm -v` |
| Python | >= 3.10 | `python3 --version` |

---

## 1. Clone & enter

```bash
git clone https://github.com/sadlu/Unipath---demo.git
cd Unipath---demo
```

## 2. Install frontend dependencies

```bash
npm install
```

## 3. Set up Python backend

### Linux / macOS

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

### Windows (PowerShell)

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

## 4. Build the Electron app

```bash
npm run build
```

## 5. Run

```bash
npm run dev
```

The app window will open. The backend starts automatically on `localhost:8000`.

---

## Email verification (optional)

To enable real email verification you need SMTP credentials.
Copy the example file and fill in your details:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your SMTP credentials (Gmail App Password recommended).

Without this, the People & Chat features work, but email verification will show
"SMTP not configured" and users won't be able to verify their email.

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
├── package.json
├── INSTALL.md
└── README.md
```

---

## Common issues

- **"python3 not found" on Windows** — use `python` instead of `python3`
- **"Cannot find module" errors** — run `npm install` and `npm run build`
- **Port 8000 already in use** — kill the existing process or change the port in `backend/config.py`
- **Backend not starting** — make sure the Python venv is activated and deps are installed
