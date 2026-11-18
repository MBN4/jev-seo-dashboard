# Installation

Tested on Ubuntu 20.04/22.04/24.04 with Python 3.12 (via `uv`) and Node.js 20/22. Docker is not required.

## 1. Python and the engine

The dashboard runs the engine from its own virtualenv. If you already run `jevseo` from a venv, skip to step 2 and point `JEVSEO_DIR` (and `JEVSEO_PYTHON` if the venv lives elsewhere) at it.

```bash
# uv provides Python 3.12 on Ubuntu 20.04 without touching the system Python
curl -LsSf https://astral.sh/uv/install.sh | sh
git clone https://github.com/agricidaniel/jev-seo ~/jev-seo
cd ~/jev-seo
uv venv .venv -p 3.12
uv pip install -p .venv/bin/python -r requirements.txt
.venv/bin/python -m jevseo doctor
```

WeasyPrint needs Pango. If `doctor` reports `weasyprint` missing, install it:

```bash
sudo apt-get install -y libpango-1.0-0 libpangoft2-1.0-0
```

### Optional: JavaScript rendering

```bash
~/jev-seo/.venv/bin/pip install playwright
~/jev-seo/.venv/bin/python -m playwright install chromium
```

On Ubuntu 20.04, the Chromium download may fail because of OS library versions. That is fine: the engine's default `--render auto` falls back to raw HTML, and the dashboard shows rendering as unavailable. **Do not upgrade Ubuntu for this.**

## 2. Node.js

Node 18.18 or newer is required, and Node 20 LTS is recommended. On Ubuntu 20.04:

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
node -v
```

## 3. The dashboard

```bash
git clone https://github.com/MBN4/jev-seo-dashboard ~/jev-seo-dashboard
cd ~/jev-seo-dashboard
cp .env.example .env.local
# edit .env.local: JEVSEO_DIR=/home/<you>/jev-seo
npm ci
```

## 4. Environment configuration

- Engine location and limits live in `.env.local` (see the table in the README).
- API keys are entered in the UI under **Settings → API keys**. They are written to `data/secrets.env` (mode 600, git-ignored) and passed only to the engine process.
- Your engine's existing `.env` is read for status but never modified.

## 5. Start

Run everything with one command:

```bash
./start.sh
```

`start.sh` does the following:

- checks Node, the engine folder, the venv and the engine packages, with a fix printed for each problem;
- installs npm dependencies and builds on the first run;
- prints the URLs and serves http://localhost:3000.

Ctrl+C stops it cleanly. Running audits are separate processes; they finish and are picked up again on the next start.

To start the server by hand instead:

```bash
npm run build
npm run start
```

For development with hot reload:

```bash
npm run dev
```

There is no separate backend process. The API is served by the same Next.js server under `/api`.

## 6. Verify

```bash
curl http://localhost:3000/api/system/health
```

Then open **Settings → Diagnostics** in the browser.
