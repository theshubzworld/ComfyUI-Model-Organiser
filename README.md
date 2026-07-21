# SimplePod — AI Model Storage Calculator

A web app for calculating, organizing, and managing AI model downloads for ComfyUI.

---

## Project Structure

```
simplepod/
│
├── api/                    ← ☁️  Cloud Backend (Vercel Serverless, Node.js)
│   ├── db.js               │      Turso (SQLite) client + schema
│   ├── load-model-list.js  │      Load all models (auto-seeds from data/ on first run)
│   ├── check-size.js       │      Fetch file sizes with HEAD/Range/API fallbacks
│   ├── save-models.js      │      Persist full model list to Turso
│   ├── resolve-civitai-names.js   Resolve CivitAI version IDs to real filenames
│   ├── civitai-explorer.js │      Browse CivitAI models
│   ├── hf-explorer.js      │      Browse HuggingFace models
│   ├── search-models.js    │      Cross-platform model search
│   ├── import-civitai-file.js     Parse civitai_download.txt
│   ├── analyze-links.js    │      Analyze URL batch for size/name
│   ├── get-tokens.js       │      Read API tokens (from Vercel env vars)
│   ├── save-tokens.js      │      Token save stub (localStorage on Vercel)
│   └── civitai-enums.js    │      CivitAI filter enums proxy
│
├── server/                 ← 🖥️  Local Dev Backend (Python)
│   ├── server.py           │      Full Python HTTP server (mirrors all /api/* endpoints)
│   └── README.md           │      How to run + endpoint reference
│
├── src/                    ← ⚛️  Frontend (React + Vite)
│   ├── components/         │      UI components
│   ├── services/           │      API helpers, size fetcher, calculations
│   ├── data/               │      Static JSON (workflows, folders)
│   ├── App.jsx             │      Root app component
│   ├── main.jsx            │      Entry point + Clerk auth wrapper
│   └── index.css           │      Global styles
│
├── data/                   ← 📦  Model Data Files
│   ├── master-model-list.txt     All 341+ models (HuggingFace + CivitAI)
│   ├── civitai_download.txt      CivitAI-specific download list
│   └── model_cache.json          Local dev size/name cache (replaced by Turso on cloud)
│
├── scripts/                ← 🔧  Utility Scripts (Python)
│   ├── extract_and_update_all_model_lists.py
│   ├── civitai_downloader.py
│   ├── download.py
│   ├── find_downloader_links.py
│   ├── modelscan.py
│   └── scan_workflows_json.py
│
├── workflows/              ← 🔄  ComfyUI Workflow JSON Files
│
├── index.html              ← Vite entry HTML
├── vite.config.js          ← Vite config (proxies /api/* → localhost:3001 in dev)
├── vercel.json             ← Vercel deployment config
├── package.json            ← npm scripts + dependencies
└── .env.example            ← Environment variable template
```

---

## Running Locally

### Option A — Start everything at once
```bash
npm run start
# Starts Python backend (port 3001) + Vite dev server (port 3000) together
```

### Option B — Start separately
```bash
# Terminal 1 — Backend
python server/server.py

# Terminal 2 — Frontend
npm run dev
```

Open **http://localhost:3000**

---

## Deploying to Vercel

See the [Deployment Guide](DEPLOY.md) for Turso + Vercel + Clerk setup.

**Quick summary:**
1. `turso db create simplepod-models` → get DB URL + token
2. Create Clerk app → get publishable key
3. Push to GitHub
4. Import to Vercel → add 5 env vars → Deploy ✓

### Required Environment Variables (Vercel)

| Variable | Description |
|----------|-------------|
| `TURSO_DATABASE_URL` | `libsql://your-db.turso.io` |
| `TURSO_AUTH_TOKEN` | Turso auth token |
| `VITE_CIVITAI_TOKEN` | CivitAI API key |
| `VITE_HF_TOKEN` | HuggingFace token |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |

---

## Tech Stack

| Layer | Local Dev | Production |
|-------|-----------|------------|
| Frontend | Vite + React 18 | Vercel CDN |
| Backend | Python HTTP server | Vercel Serverless (Node.js 20) |
| Database | `data/model_cache.json` | Turso (SQLite edge DB) |
| Auth | None (open) | Clerk |
| Styling | TailwindCSS v4 | Same |
