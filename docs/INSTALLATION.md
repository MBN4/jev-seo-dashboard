# Installation

Tested on Ubuntu 20.04, 22.04 and 24.04 with Python 3.12 (via `uv`) and Node.js 20/22. Docker is not required.

## 1. The audit engine (Python)

AuditPilot runs an open-source audit engine as a separate process (see [NOTICE.md](../NOTICE.md)). If you already have it installed with a working virtualenv, skip to step 2.

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh          # Python 3.12 without touching the system Python
git clone https://github.com/agricidaniel/jev-seo ~/audit-engine
cd ~/audit-engine
uv venv .venv -p 3.12
uv pip install -p .venv/bin/python -r requirements.txt
```

WeasyPrint (used for PDF reports) needs Pango. If PDFs fail, install it:

```bash
sudo apt-get install -y libpango-1.0-0 libpangoft2-1.0-0
```

### Optional: JavaScript rendering

```bash
~/audit-engine/.venv/bin/pip install playwright
~/audit-engine/.venv/bin/python -m playwright install chromium
```

On Ubuntu 20.04 the Chromium download may fail. That is fine: crawling falls back to raw HTML, and AuditPilot shows rendering as unavailable. Do not upgrade Ubuntu for this.

## 2. Node.js

Node 18.18 or newer (20 LTS recommended). On Ubuntu 20.04:

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
```

## 3. AuditPilot

```bash
git clone https://github.com/MBN4/auditpilot ~/auditpilot
cd ~/auditpilot
cp .env.example .env.local
```

Edit `.env.local` and set `AUDITPILOT_ENGINE_DIR` to the engine folder, for example `AUDITPILOT_ENGINE_DIR=/home/you/audit-engine`. Existing `.env.local` files that use the older `JEVSEO_DIR` keep working.

## 4. Keys (optional)

Start AuditPilot, then open **Settings → API keys**:

- Paste each key and press **Save**, then **Verify**.
- Keys are stored in `data/secrets.env` (mode 600, git-ignored) and passed only to the engine process.
- Your engine's own `.env` is read for status but never changed.

## 5. Start

```bash
./start.sh
```

`start.sh` does the following:

- checks Node, the engine folder, its Python environment and packages, with a fix printed for each problem;
- installs dependencies and builds when needed;
- serves http://localhost:3000.

Ctrl+C stops it. Running audits are separate processes and finish on their own.

On first start, the bundled audits of your five sites (`seed/`) are added to the reports folder, and their branded reports are prepared in the background.

Development mode with hot reload:

```bash
./start.sh --dev
```

## 6. Verify

```bash
curl http://localhost:3000/api/system/health
```

Then open **Settings → Diagnostics**.
