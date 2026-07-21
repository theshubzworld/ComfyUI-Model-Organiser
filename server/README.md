# server/ — Local Development Backend

This directory contains the **Python backend server** used during local development.

## How to Run

```bash
# From the project root
python server/server.py
```

The server starts on **http://localhost:3001** and handles all `/api/*` requests.

Vite's dev server (`npm run dev`) automatically proxies `/api/*` to this port.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/load-model-list` | Load all models from `data/master-model-list.txt` |
| GET | `/api/import-civitai-file` | Parse `data/civitai_download.txt` |
| GET | `/api/get-tokens` | Read HF + CivitAI tokens from `.env` |
| POST | `/api/save-tokens` | Save tokens to `.env` |
| POST | `/api/check-size` | Fetch file size via HEAD/Range/API |
| POST | `/api/save-models` | Write model list to `data/master-model-list.txt` |
| POST | `/api/resolve-civitai-names` | Resolve CivitAI version IDs to filenames |
| GET | `/api/civitai-explorer` | Browse CivitAI models |
| GET | `/api/hf-explorer` | Browse HuggingFace models |
| GET | `/api/search-models` | Search both platforms |
| GET | `/api/civitai-enums` | CivitAI filter enums |
| POST | `/api/analyze-links` | Analyze URL batch for size/filename |

## Production (Vercel)

On Vercel, the `api/` directory at project root handles all `/api/*` requests
via **serverless Node.js functions** connected to **Turso** (cloud SQLite DB).

This Python server is **not used in production**.
