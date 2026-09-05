from typing import Literal

from pydantic import BaseModel


class Book(BaseModel):
    id: int
    title: str | None
    authors: str | None
    pages: int
    current_page: int
    progress_pct: float
    last_read: str | None
    status: Literal["reading", "finished"]


class DailyPoint(BaseModel):
    date: str
    seconds: int


class WeeklyPoint(BaseModel):
    week_start: str
    seconds: int


class Summary(BaseModel):
    total_reading_seconds: int
    streak_days: int
    pages_this_week: int
    pages_this_month: int
    books_finished: int
    daily: list[DailyPoint]
    weekly: list[WeeklyPoint]
    last_synced: str | None
    stale: bool
    last_error: str | None = None


class BookSession(BaseModel):
    date: str
    seconds: int
    pages_read: int


class BookStats(BaseModel):
    book_id: int
    title: str | None
    total_seconds: int
    pace_seconds_per_page: float | None
    sessions: list[BookSession]


class Health(BaseModel):
    status: str
    snapshot_exists: bool
    last_synced: str | None
    stale: bool
    last_error: str | None = None


class RefreshResult(BaseModel):
    ok: bool
    last_synced: str | None
    stale: bool
    last_error: str | None = None
