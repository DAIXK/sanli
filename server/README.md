# Flask material service

Serve the files under `server/models` at `/static/models` and expose the Vue front-end `MATERIAL_CONFIG` via JSON.

## Setup

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
python -m server.app  # or: flask --app server.app run --host=0.0.0.0 --port=5000
```

- `http://localhost:5000/api/materials` returns `MATERIAL_CONFIG`.
- `http://localhost:5000/static/models/<asset>` serves the assets in `server/models`.

The service enables permissive CORS headers so the H5/uni-app front-end can request both the JSON API and static files from another origin (e.g. Vite dev server).
