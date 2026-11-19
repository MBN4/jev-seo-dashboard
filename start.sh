#!/usr/bin/env bash
# SEO dashboard launcher (product name: lib/brand.ts or NEXT_PUBLIC_BRAND_NAME).
#   ./start.sh          production mode (builds on first run), http://localhost:3000
#   ./start.sh --dev    development mode with hot reload
# The dashboard runs the jev-seo engine found at $JEVSEO_DIR (default: ../jev-seo).
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")"

MODE="prod"
[ "${1:-}" = "--dev" ] && MODE="dev"
PORT="${PORT:-3000}"

red() { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
dim() { printf '\033[2m%s\033[0m\n' "$*"; }

# Settings from .env.local (JEVSEO_DIR, JEVSEO_PYTHON, ...) without overriding the shell.
if [ -f .env.local ]; then
  while IFS='=' read -r k v; do
    [[ "$k" =~ ^[A-Z_][A-Z0-9_]*$ ]] || continue
    [ -z "${!k:-}" ] && export "$k=$v"
  done < <(grep -E '^[A-Z_][A-Z0-9_]*=' .env.local)
fi

ENGINE_DIR="${JEVSEO_DIR:-$(pwd)/../jev-seo}"
ENGINE_DIR="$(cd "$ENGINE_DIR" 2>/dev/null && pwd || echo "$ENGINE_DIR")"
fail=0

# 1. Node.js
if ! command -v node >/dev/null; then
  red "Node.js not found. Install Node 20 LTS (see docs/INSTALLATION.md)."; exit 1
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 18 ]; then red "Node $(node -v) is too old; Next.js 15 needs Node 18.18 or newer."; exit 1; fi

# 2. Engine
if [ ! -f "$ENGINE_DIR/jevseo/cli.py" ]; then
  red "jev-seo engine not found at: $ENGINE_DIR"
  echo "  Clone it next to this folder, or set JEVSEO_DIR in .env.local, e.g.:"
  echo "    echo 'JEVSEO_DIR=$HOME/jev-seo' >> .env.local"
  fail=1
fi

# 3. Python environment used by the engine
PY="${JEVSEO_PYTHON:-}"
if [ -z "$PY" ]; then
  for c in "$ENGINE_DIR/.venv/bin/python" "$ENGINE_DIR/venv/bin/python"; do [ -x "$c" ] && PY="$c" && break; done
fi
if [ -z "$PY" ]; then
  red "No Python virtualenv found for the engine ($ENGINE_DIR/.venv)."
  echo "  Create one (uv works on Ubuntu 20.04):"
  echo "    cd $ENGINE_DIR && uv venv .venv -p 3.12 && uv pip install -p .venv/bin/python -r requirements.txt"
  echo "  or set JEVSEO_PYTHON in .env.local to the interpreter you already use."
  fail=1
elif ! PYTHONPATH="$ENGINE_DIR" "$PY" -c "import requests, bs4, lxml, matplotlib, jinja2, weasyprint, openpyxl" 2>/dev/null; then
  red "Engine Python ($PY) is missing packages. Run:"
  echo "    $PY -m pip install -r $ENGINE_DIR/requirements.txt"
  fail=1
fi
[ "$fail" = 1 ] && exit 1
export JEVSEO_DIR="$ENGINE_DIR" JEVSEO_PYTHON="$PY"
if ! PYTHONPATH="$ENGINE_DIR" "$PY" -c "import playwright" 2>/dev/null; then
  dim "Note: Playwright not installed; JavaScript rendering is off. Standard crawling works normally."
fi

# 4. Frontend dependencies and build
if [ ! -d node_modules ]; then
  echo "Installing dashboard dependencies (first run)..."
  npm ci --no-audit --no-fund
fi
if [ "$MODE" = "prod" ] && [ ! -f .next/BUILD_ID ]; then
  echo "Building the dashboard (first run, about a minute)..."
  npm run build
fi

green "${NEXT_PUBLIC_BRAND_NAME:-Rankora} dashboard"
echo "  Dashboard:  http://localhost:$PORT"
echo "  API:        http://localhost:$PORT/api  (e.g. /api/system/health)"
echo "  Engine:     $ENGINE_DIR (python: $PY)"
echo "  Reports:    ${JEVSEO_REPORTS_DIR:-$ENGINE_DIR/jev-seo-reports}"
dim "Press Ctrl+C to stop. Running audits are separate processes and finish on their own."

if [ "$MODE" = "dev" ]; then
  exec npx next dev -H 127.0.0.1 -p "$PORT"
else
  exec npx next start -H 127.0.0.1 -p "$PORT"
fi
