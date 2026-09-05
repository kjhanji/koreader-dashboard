from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException

from app.config import settings
from app.models import Book, BookStats, Health, RefreshResult, Summary
from app.parser import empty_payload
from app.snapshot import StatsStore

store = StatsStore(settings)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(title="KOReader Stats API", lifespan=lifespan)


@app.get("/health", response_model=Health)
def health() -> Health:
    payload = store.payload
    return Health(
        status="ok",
        snapshot_exists=store.snapshot_exists(),
        last_synced=payload.get("last_synced"),
        stale=bool(payload.get("stale", True)),
        last_error=payload.get("last_error"),
    )


@app.get("/books", response_model=list[Book])
async def list_books() -> list[Book]:
    payload = await store.get_fresh()
    return [Book.model_validate(book) for book in payload.get("books", [])]


@app.get("/stats/summary", response_model=Summary)
async def stats_summary() -> Summary:
    payload = await store.get_fresh()
    defaults = empty_payload()["summary"]
    summary = payload.get("summary") or {}
    return Summary.model_validate({**defaults, **summary})


@app.get("/stats/{book_id}", response_model=BookStats)
async def book_stats(book_id: int) -> BookStats:
    payload = await store.get_fresh()
    stats = payload.get("book_stats", {}).get(str(book_id))
    if not stats:
        raise HTTPException(status_code=404, detail=f"No stats for book {book_id}")
    return BookStats.model_validate(stats)


@app.post("/refresh", response_model=RefreshResult)
async def refresh() -> RefreshResult:
    payload = await store.refresh(force=True)
    return RefreshResult(
        ok=not payload.get("stale", True),
        last_synced=payload.get("last_synced"),
        stale=bool(payload.get("stale", True)),
        last_error=payload.get("last_error"),
    )
