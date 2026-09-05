# koreader-dashboard

Syncs KOReader stats from a jailbroken Kindle via WebDAV → parses with FastAPI → visualizes with Next.js.

## Increment 1 (backend)

Opening or refreshing the dashboard hits the API, which downloads the latest `statistics.sqlite3` from Koofr, parses it, and returns stats. Results are cached in memory for `CACHE_TTL_SECONDS` (default 30) so a page that calls several endpoints does not download the file three times. The Next.js UI is Increment 2.

Koofr has no webhook, so the site cannot be pushed the instant the Kindle uploads. Opening or refreshing the page after KOReader syncs is enough to see the new data.

### Setup

```bash
cp .env.example .env
```

Fill in `WEBDAV_USERNAME` (Koofr email) and `WEBDAV_PASSWORD` (Koofr app-specific password). Defaults assume the file lives at `/readingStats/statistics.sqlite3` on `https://app.koofr.net/dav/Koofr`.

### Run

```bash
docker compose up --build
```

The API listens on `http://localhost:8000`.

### Endpoints

```bash
curl http://localhost:8000/health
curl -X POST http://localhost:8000/refresh
curl http://localhost:8000/books
curl http://localhost:8000/stats/summary
curl http://localhost:8000/stats/1
```

`GET /health` does not talk to Koofr. The other GET endpoints fetch if the cache is older than 30 seconds. `POST /refresh` always fetches. If Koofr is unreachable, the last good result is returned and marked `stale`.
