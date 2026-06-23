# UniPath

A desktop app for discovering educational and career opportunities in Nepal.

Built with **Electron** + **React** + **Python FastAPI**.

## Features

- **Search** — AI-powered search across scholarships, internships, and events in Nepal
- **Discover** — Live web results for upcoming opportunities, filtered by freshness
- **People** — Find and follow other users
- **Chat** — Real-time messaging between verified users
- **Settings** — Email verification, themes, and account management

## Quick start

See [INSTALL.md](INSTALL.md) for full setup instructions.

```bash
npm install && cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && cd .. && npm run build && npm run dev
```

## Tech stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, Zustand
- **Desktop:** Electron
- **Backend:** Python, FastAPI, SQLite, DuckDuckGo Search
- **Auth:** Local encrypted storage (no external service required)
