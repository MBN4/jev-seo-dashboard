#!/usr/bin/env bash
# AuditPilot launcher.
#   ./start.sh          production mode, http://localhost:3000 (installs and rebuilds when needed)
#   ./start.sh --dev    development mode with hot reload
# Settings come from .env.local (see .env.example). Older JEVSEO_* names are still accepted.
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")"

MODE="prod"
[ "${1:-}" = "--dev" ] && MODE="dev"
PORT="${PORT:-3000}"

red() { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
dim() { printf '\033[2m%s\033[0m\n' "$*"; }

# Settings from .env.local without overriding the shell.
if [ -f .env.local ]; then
  while IFS='=' read -r k v; do
    [[ "$k" =~ ^[A-Z_][A-Z0-9_]*$ ]] || continue
    [ -z "${!k:-}" ] && export "$k=$v"
  done < <(grep -E '^[A-Z_][A-Z0-9_]*=' .env.local)
fi

ENGINE_DIR="${AUDITPILOT_ENGINE_DIR:-${RANKORA_ENGINE_DIR:-${JEVSEO_DIR:-$(pwd)/../jev-seo}}}"
ENGINE_DIR="$(cd "$ENGINE_DIR" 2>/dev/null && pwd || echo "$ENGINE_DIR")"
fail=0

# 1. Node.js
if ! command -v node >/dev/null; then
  red "Node.js not found. Install Node 20 LTS (see docs/INSTALLATION.md)."; exit 1
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 18 ]; then red "Node $(node -v) is too old; Next.js 15 needs Node 18.18 or newer."; exit 1; fi

# 2. Audit engine
if [ ! -f "$ENGINE_DIR/jevseo/cli.py" ]; then
  red "Audit engine not found at: $ENGINE_DIR"
  echo "  Set its folder in .env.local, e.g.:"
  echo "    echo 'AUDITPILOT_ENGINE_DIR=$HOME/path/to/engine' >> .env.local"
  echo "  (see docs/INSTALLATION.md)"
  fail=1
fi

# 3. Python environment used by the engine
PY="${AUDITPILOT_ENGINE_PYTHON:-${RANKORA_ENGINE_PYTHON:-${JEVSEO_PYTHON:-}}}"
if [ -z "$PY" ]; then
  for c in "$ENGINE_DIR/.venv/bin/python" "$ENGINE_DIR/venv/bin/python"; do [ -x "$c" ] && PY="$c" && break; done
fi
if [ -z "$PY" ]; then
  red "No Python virtualenv found for the engine ($ENGINE_DIR/.venv)."
  echo "  Create one (uv works on Ubuntu 20.04):"
  echo "    cd $ENGINE_DIR && uv venv .venv -p 3.12 && uv pip install -p .venv/bin/python -r requirements.txt"
  echo "  or set AUDITPILOT_ENGINE_PYTHON in .env.local to the interpreter you already use."
  fail=1
elif ! PYTHONPATH="$ENGINE_DIR" "$PY" -c "import requests, bs4, lxml, matplotlib, jinja2, weasyprint, openpyxl" 2>/dev/null; then
  red "Engine Python ($PY) is missing packages. Run:"
  echo "    $PY -m pip install -r $ENGINE_DIR/requirements.txt"
  fail=1
fi
[ "$fail" = 1 ] && exit 1
export AUDITPILOT_ENGINE_DIR="$ENGINE_DIR" AUDITPILOT_ENGINE_PYTHON="$PY"
if ! PYTHONPATH="$ENGINE_DIR" "$PY" -c "import playwright" 2>/dev/null; then
  dim "Note: Playwright not installed; JavaScript rendering is off. Standard crawling works normally."
fi

# Large audits (thousands of pages) are loaded whole; give Node room unless the user chose a size.
case " ${NODE_OPTIONS:-} " in *max-old-space-size*) ;; *) export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=4096" ;; esac

# 4. Dependencies and build: (re)install / rebuild only when something changed, e.g. after git pull.
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  echo "Installing dependencies..."
  npm ci --no-audit --no-fund
fi
if [ "$MODE" = "prod" ]; then
  if [ ! -f .next/BUILD_ID ] || [ -n "$(find app components lib hooks types middleware.ts instrumentation.ts instrumentation-node.ts next.config.ts package.json .env.local -newer .next/BUILD_ID -print -quit 2>/dev/null)" ]; then
    echo "Building (about a minute)..."
    npm run build
  fi
fi

green "${NEXT_PUBLIC_BRAND_NAME:-AuditPilot}"
echo "  Dashboard:  http://localhost:$PORT"
echo "  API:        http://localhost:$PORT/api  (e.g. /api/system/health)"
dim "Press Ctrl+C to stop. Running audits are separate processes and finish on their own."

if [ "$MODE" = "dev" ]; then
  exec npx next dev -H 127.0.0.1 -p "$PORT"
else
  exec npx next start -H 127.0.0.1 -p "$PORT"
fi
