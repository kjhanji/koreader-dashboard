# koreader-dashboard

Syncs KOReader stats from a jailbroken Kindle via WebDAV → parses with FastAPI → visualizes with Next.js.

Opening or refreshing the dashboard downloads the latest `statistics.sqlite3` from Koofr (cached for 30 seconds). Koofr has no webhook, so an already-open tab does not jump the instant the Kindle uploads.

## Setup

```bash
cp .env.example .env
```

Fill in `WEBDAV_USERNAME` (Koofr email) and `WEBDAV_PASSWORD` (Koofr app-specific password). Defaults assume the file lives at `/readingStats/statistics.sqlite3` on `https://app.koofr.net/dav/Koofr`.

## Run

```bash
docker compose up --build
```

- Dashboard: http://localhost:3000
- API: http://localhost:8000

### Local (without Docker)

```bash
# backend
cd backend && uvicorn app.main:app --reload --port 8000

# frontend
cd frontend && npm install && npm run dev
```

## Hosted (Vercel, free Hobby)

The Next.js app fetches Koofr on the server. There is no public Refresh button; reload the page after KOReader syncs (30s cache).

Set these in the Vercel project (never commit `.env`): `WEBDAV_URL`, `WEBDAV_USERNAME`, `WEBDAV_PASSWORD`, `KOREADER_DB_PATH`, `CACHE_TTL_SECONDS`, `TIMEZONE`. Root directory: `frontend`.

## API

```bash
curl http://localhost:8000/health
curl -X POST http://localhost:8000/refresh
curl http://localhost:8000/books
curl http://localhost:8000/stats/summary
curl http://localhost:8000/stats/1
```

`GET /health` does not talk to Koofr. The other GET endpoints fetch if the cache is older than 30 seconds. `POST /refresh` always fetches. If Koofr is unreachable, the last good result is returned and marked `stale`.
