#!/usr/bin/env bash
set -e

# ────────────────────────────────────────────────────────────
# UniPath — Cross-platform setup script (Linux / macOS)
# Checks what's missing, asks before installing, then sets up.
# ────────────────────────────────────────────────────────────

BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
CYAN="\033[0;36m"
NC="\033[0m"  # No Color

info()  { printf "${CYAN}%s${NC}\n" "$*"; }
ok()    { printf "${GREEN}%s${NC}\n" "$*"; }
warn()  { printf "${YELLOW}%s${NC}\n" "$*"; }

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

MISSING=()

# ── Check Node.js ──
check_node() {
  info "[1/6] Checking Node.js …"
  if command -v node &>/dev/null; then
    VER=$(node -v | sed 's/v//')
    MAJOR=${VER%%.*}
    if [ "$MAJOR" -ge 18 ] 2>/dev/null; then
      ok "  Node.js $VER found"
    else
      warn "  Node.js $VER found, but >= 18 required"
      MISSING+=("nodejs")
    fi
  else
    warn "  Node.js not found"
    MISSING+=("nodejs")
  fi
}

# ── Check npm ──
check_npm() {
  info "[2/6] Checking npm …"
  if command -v npm &>/dev/null; then
    VER=$(npm -v)
    MAJOR=${VER%%.*}
    if [ "$MAJOR" -ge 9 ] 2>/dev/null; then
      ok "  npm $VER found"
    else
      warn "  npm $VER found, but >= 9 recommended"
    fi
  else
    warn "  npm not found (will be installed with Node.js)"
  fi
}

# ── Check Python ──
check_python() {
  info "[3/6] Checking Python …"

  # Try python3 first, then python
  PYTHON=""
  if command -v python3 &>/dev/null; then
    PYTHON="python3"
  elif command -v python &>/dev/null; then
    PYTHON="python"
  fi

  if [ -n "$PYTHON" ]; then
    VER=$("$PYTHON" --version 2>&1 | sed 's/Python //')
    MAJOR=${VER%%.*}
    MINOR=${VER#*.}; MINOR=${MINOR%%.*}
    if [ "$MAJOR" -ge 3 ] && [ "$MINOR" -ge 10 ] 2>/dev/null; then
      ok "  Python $VER found ($PYTHON)"
    else
      warn "  Python $VER found, but >= 3.10 required"
      MISSING+=("python")
    fi
  else
    warn "  Python not found"
    MISSING+=("python")
  fi
}

# ── Check venv module ──
check_venv() {
  info "[4/6] Checking Python venv …"
  if [ -n "$PYTHON" ] && "$PYTHON" -c "import venv" 2>/dev/null; then
    ok "  venv module available"
  else
    warn "  venv module not available"
    MISSING+=("venv")
  fi
}

# ── Install missing dependencies ──
install_missing() {
  if [ ${#MISSING[@]} -eq 0 ]; then
    ok "\nAll dependencies satisfied!"
    return
  fi

  echo ""
  warn "The following are missing: ${MISSING[*]}"
  read -rp "  Install them now? [Y/n] " REPLY
  REPLY=${REPLY:-Y}
  case "$REPLY" in
    [Yy]*|"") ;;
    *) echo "Aborted."; exit 1 ;;
  esac

  # Detect package manager
  PMGR=""
  if command -v apt &>/dev/null; then PMGR="apt"
  elif command -v brew &>/dev/null; then PMGR="brew"
  elif command -v dnf &>/dev/null; then PMGR="dnf"
  elif command -v yum &>/dev/null; then PMGR="yum"
  elif command -v pacman &>/dev/null; then PMGR="pacman"
  fi

  for dep in "${MISSING[@]}"; do
    case "$dep" in
      nodejs)
        if [ "$PMGR" = "apt" ]; then
          sudo apt update && sudo apt install -y nodejs npm
        elif [ "$PMGR" = "brew" ]; then
          brew install node
        elif [ "$PMGR" = "dnf" ]; then
          sudo dnf install -y nodejs npm
        elif [ "$PMGR" = "pacman" ]; then
          sudo pacman -S --noconfirm nodejs npm
        else
          warn "  No known package manager. Please install Node.js from https://nodejs.org"
        fi
        ;;
      python)
        if [ "$PMGR" = "apt" ]; then
          sudo apt update && sudo apt install -y python3 python3-pip
        elif [ "$PMGR" = "brew" ]; then
          brew install python
        elif [ "$PMGR" = "dnf" ]; then
          sudo dnf install -y python3 python3-pip
        elif [ "$PMGR" = "pacman" ]; then
          sudo pacman -S --noconfirm python python-pip
        else
          warn "  No known package manager. Please install Python from https://www.python.org/downloads/"
        fi
        ;;
      venv)
        if [ "$PMGR" = "apt" ]; then
          sudo apt update && sudo apt install -y python3-venv
        elif [ "$PMGR" = "brew" ]; then
          ok "  venv is included with Homebrew Python"
        elif [ "$PMGR" = "dnf" ]; then
          sudo dnf install -y python3-virtualenv
        elif [ "$PMGR" = "pacman" ]; then
          sudo pacman -S --noconfirm python-virtualenv
        else
          warn "  Please install python3-venv for your distribution"
        fi
        ;;
    esac
  done

  # Re-check after installation
  MISSING=()
  check_node
  check_npm
  check_python
  check_venv
}

# ── Setup steps ──
setup_project() {
  echo ""
  info "[5/6] Installing frontend dependencies (npm install) …"
  npm install

  echo ""
  info "[6/6] Setting up Python backend …"
  cd backend
  if [ ! -d ".venv" ]; then
    "$PYTHON" -m venv .venv
  fi
  source .venv/bin/activate
  pip install -r requirements.txt
  cd "$DIR"

  # Build
  echo ""
  info "Building the app …"
  npm run build

  echo ""
  ok "══════════════════════════════════════════════"
  ok "  UniPath setup complete!"
  ok "  Run it with:  npm start"
  ok "══════════════════════════════════════════════"

  echo ""
  read -rp "Launch UniPath now? [Y/n] " LAUNCH
  LAUNCH=${LAUNCH:-Y}
  if [[ "$LAUNCH" =~ ^[Yy]?$ ]]; then
    npm start
  fi
}

# ── Main ──
clear
printf "${BOLD}${CYAN}"
cat << "EOF"
   _    _       _ _   _       ____  _     _
  | |  | |     | | | (_)     |  _ \| |__ (_)_ __
  | |  | |_ __ | | |_ _  __ _| |_) | '_ \| | '_ \
  | |  | | '_ \| | __| |/ _` |  __/| | | | | |_) |
  | |__| | | | | | |_| | (_| | |   | | | | | .__/
   \____/|_| |_|_|\__|_|\__,_|_|   |_| |_|_|_|
EOF
printf "${NC}\n"
printf "${BOLD}UniPath — Setup Script${NC}\n\n"

check_node
check_npm
check_python
check_venv
install_missing
setup_project
