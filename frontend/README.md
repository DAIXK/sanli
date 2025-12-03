# Frontend

The Vue/uni-app client now loads bracelet tabs and bead data from a configurable backend.

## Configure the API base URL

Set an environment variable that Vite can read, for example in `frontend/.env.development.local`:

```
VITE_API_BASE_URL=http://localhost:3000
```

If you skip this step the client falls back to the current origin.

## Run the dev server

```bash
cd frontend
npm install  # only if dependencies are missing
npm run dev
```

The page will request `GET $VITE_API_BASE_URL/api/mobile/tabs` and the detail endpoints `GET $VITE_API_BASE_URL/api/mobile/tabs/:id`, so make sure the backend service is running and reachable.
It also fetches the gold price from `GET $VITE_API_BASE_URL/api/mobile/gold-price`.
