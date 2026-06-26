<div align="center">

# UniPath

**Your AI-powered opportunity compass for Nepal**

Discover scholarships, internships, events, and career paths — all in one place.

<br>

[![Download for Windows](https://img.shields.io/badge/Download_for_Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/sadlu/Unipath---demo/releases/latest)
[![Download for macOS](https://img.shields.io/badge/Download_for_macOS-000000?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/sadlu/Unipath---demo/releases/latest)
[![Download for Linux](https://img.shields.io/badge/Download_for_Linux-E95420?style=for-the-badge&logo=linux&logoColor=white)](https://github.com/sadlu/Unipath---demo/releases/latest)

[![Latest Release](https://img.shields.io/github/v/release/sadlu/Unipath---demo?style=flat-square)](https://github.com/sadlu/Unipath---demo/releases)
[![License](https://img.shields.io/github/license/sadlu/Unipath---demo?style=flat-square)](LICENSE)

</div>

## Features

- **Search** — AI-powered search across scholarships, internships, and events in Nepal
- **Discover** — Live web results for upcoming opportunities, filtered by freshness
- **People** — Find and follow other users
- **Chat** — Real-time messaging between verified users
- **Settings** — Email verification, themes, and account management

## Download

| Platform | Installer | Size |
|----------|-----------|------|
| Windows | [UniPath-Setup.exe](https://github.com/sadlu/Unipath---demo/releases/latest) (~150 MB) | One-click installer — handles everything |
| macOS | [UniPath.dmg](https://github.com/sadlu/Unipath---demo/releases/latest) (~150 MB) | Drag to Applications |
| Linux | [UniPath.AppImage](https://github.com/sadlu/Unipath---demo/releases/latest) (~150 MB) | Make executable and run |

The Windows installer automatically:
- Installs Visual C++ Redistributables if missing
- Adds a firewall exception for the backend
- Creates desktop and Start Menu shortcuts
- Launches UniPath when installation completes

## Build from source

See [INSTALL.md](INSTALL.md) for full instructions.

```bash
git clone https://github.com/sadlu/Unipath---demo.git
cd Unipath---demo
npm install
cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && cd ..
npm run build
npm start
```

## Tech stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, Zustand
- **Desktop:** Electron (cross-platform desktop app)
- **Mobile:** Capacitor (Android APK)
- **Backend:** Python, FastAPI, SQLite/PostgreSQL, DuckDuckGo Search
- **AI:** 8+ LLM providers (Groq, Gemini, Ollama, OpenRouter, etc.)
- **Auth:** Local encrypted storage (no external service required)
