# Frontend

The Vue/uni-app client now loads data and assets from the Flask service.

## Configure the API base URL

Set an environment variable that Vite can read, for example in `frontend/.env.development.local`:

```
VITE_API_BASE_URL=http://localhost:5000
```

If you skip this step the client falls back to `http://localhost:5000`.

## Run the dev server

```bash
cd frontend
npm install  # only if dependencies are missing
npm run dev
```

The page will request `GET $VITE_API_BASE_URL/api/materials` and load models/images from `$VITE_API_BASE_URL/static/models/...`, so make sure the Flask service is running as described in `../server/README.md`.
