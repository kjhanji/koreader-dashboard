# Project: KOReader Reading Stats Dashboard

## Overview
Build a personal web dashboard that visualizes my e-reading habits, sourced from KOReader's local statistics database on a jailbroken Kindle. The database syncs automatically to a WebDAV cloud storage provider (Koofr). The app should pull that database, parse it, and render reading stats in a clean web UI.

## Data Source
- KOReader logs reading activity to a local SQLite database, `statistics.sqlite3`.
- This file is synced automatically (on book open/close) to a WebDAV server (Koofr, free tier) at a known path.
- Relevant tables:
  - `book` — columns include `id`, `title`, `authors`, `pages`, `last_open`
  - `page_stat_data` — per-reading-session log, columns include `id_book`, `page`, `start_time`, `duration`
- **Important gotcha**: to determine a book's "current page," do NOT use `MAX(page)` — flipping back to re-read a page inflates it permanently. Instead, use the page from the most recent session:
  ```sql
  SELECT page FROM page_stat_data
  WHERE id_book = ?
  ORDER BY start_time DESC
  LIMIT 1
  ```

## Architecture
- **Backend**: FastAPI (Python)
  - Connects to the WebDAV server, downloads `statistics.sqlite3`
  - Parses it with Python's built-in `sqlite3` module
  - Exposes REST endpoints:
    - `GET /books` — list of books with title, authors, pages, progress %, last read date
    - `GET /stats/summary` — aggregate stats: total reading time, current streak, pages read this week/month, books finished
    - `GET /stats/{book_id}` — per-book detail: reading sessions over time, time spent, pace
  - WebDAV credentials (URL, username, app-specific password) should be configurable via environment variables, not hardcoded
  - Should handle the case where the WebDAV file hasn't updated yet gracefully (don't crash on stale/missing data)

- **Frontend**: Next.js (React)
  - Fetches from the FastAPI endpoints
  - Renders:
    - "Currently reading" section with progress bars
    - "Finished" books list, sorted by completion date
    - A reading-time-over-time chart (daily/weekly)
    - A reading streak indicator
  - Use a charting library (e.g. Recharts) for visualizations
  - Keep the UI simple and clean — this is a personal single-user dashboard, not a public product. No auth needed unless specified otherwise.

## Deployment
- Docker Compose setup with two services: FastAPI backend, Next.js frontend
- Backend should support running as either a live API or a scheduled job that writes a JSON snapshot (whichever is simpler to implement first — data only changes when I finish reading, so real-time isn't required)

## Scope for v1 (keep it minimal)
1. Backend: WebDAV fetch + SQLite parse + the three endpoints above
2. Frontend: one page with currently-reading list, finished list, and a reading-time chart
3. Docker Compose to run both locally

Do not over-build — no auth, no multi-user support, no mobile app, no database beyond the synced SQLite file itself. Confirm the actual schema of a real `statistics.sqlite3` file before writing parsing logic, since exact column names/types should be verified rather than assumed.
