from __future__ import annotations

import sqlite3
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

REQUIRED_TABLES = {
    "book": {"id", "title", "authors", "pages", "last_open"},
    "page_stat_data": {"id_book", "page", "start_time", "duration"},
}


class SchemaError(Exception):
    pass


def _table_columns(conn: sqlite3.Connection, table: str) -> set[str]:
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    if not rows:
        raise SchemaError(f"Missing table: {table}")
    return {row[1] for row in rows}


def verify_schema(conn: sqlite3.Connection) -> None:
    for table, required in REQUIRED_TABLES.items():
        columns = _table_columns(conn, table)
        missing = required - columns
        if missing:
            raise SchemaError(
                f"Table {table} is missing columns: {', '.join(sorted(missing))}"
            )


def _to_local_date(ts: int, tz: ZoneInfo) -> date:
    return datetime.fromtimestamp(int(ts), tz=tz).date()


def _iso_datetime(ts: int | None, tz: ZoneInfo) -> str | None:
    if ts is None:
        return None
    return datetime.fromtimestamp(int(ts), tz=tz).isoformat()


def _week_start(day: date) -> date:
    return day - timedelta(days=day.weekday())


def _streak_days(active_days: set[date], today: date) -> int:
    if not active_days:
        return 0
    cursor = today if today in active_days else today - timedelta(days=1)
    if cursor not in active_days:
        return 0
    streak = 0
    while cursor in active_days:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def empty_payload(last_error: str | None = None, stale: bool = True) -> dict:
    return {
        "generated_at": None,
        "last_synced": None,
        "stale": stale,
        "last_error": last_error,
        "books": [],
        "summary": {
            "total_reading_seconds": 0,
            "streak_days": 0,
            "pages_this_week": 0,
            "pages_this_month": 0,
            "books_finished": 0,
            "daily": [],
            "weekly": [],
            "last_synced": None,
            "stale": stale,
            "last_error": last_error,
        },
        "book_stats": {},
    }


def parse_statistics_db(db_path: Path, timezone: str) -> dict:
    tz = ZoneInfo(timezone)
    now = datetime.now(tz)
    today = now.date()
    week_start = _week_start(today)
    month_start = today.replace(day=1)

    uri = f"file:{db_path.resolve()}?mode=ro"
    conn = sqlite3.connect(uri, uri=True)
    conn.row_factory = sqlite3.Row
    try:
        verify_schema(conn)
        books = conn.execute(
            "SELECT id, title, authors, pages, last_open FROM book ORDER BY last_open DESC"
        ).fetchall()
        page_rows = conn.execute(
            """
            SELECT id_book, page, start_time, duration
            FROM page_stat_data
            ORDER BY start_time ASC
            """
        ).fetchall()
    finally:
        conn.close()

    latest_page: dict[int, int] = {}
    latest_start: dict[int, int] = {}
    totals: dict[int, int] = defaultdict(int)
    unique_pages: dict[int, set[int]] = defaultdict(set)
    daily_book: dict[int, dict[date, dict[str, int]]] = defaultdict(
        lambda: defaultdict(lambda: {"seconds": 0, "pages_read": 0})
    )
    daily_all: dict[date, int] = defaultdict(int)
    active_days: set[date] = set()
    pages_this_week = 0
    pages_this_month = 0

    for row in page_rows:
        book_id = int(row["id_book"])
        page = int(row["page"] or 0)
        start_time = int(row["start_time"] or 0)
        duration = int(row["duration"] or 0)
        local_day = _to_local_date(start_time, tz)

        if book_id not in latest_start or start_time >= latest_start[book_id]:
            latest_start[book_id] = start_time
            latest_page[book_id] = page

        totals[book_id] += duration
        unique_pages[book_id].add(page)
        daily_book[book_id][local_day]["seconds"] += duration
        daily_book[book_id][local_day]["pages_read"] += 1
        daily_all[local_day] += duration
        if duration > 0:
            active_days.add(local_day)
        if local_day >= week_start:
            pages_this_week += 1
        if local_day >= month_start:
            pages_this_month += 1

    parsed_books = []
    book_stats: dict[str, dict] = {}
    books_finished = 0

    for book in books:
        book_id = int(book["id"])
        pages = int(book["pages"] or 0)
        current_page = latest_page.get(book_id, 0)
        last_open = book["last_open"]
        last_session = latest_start.get(book_id)
        last_read_ts = last_session if last_session is not None else last_open
        finished = pages > 0 and current_page >= pages
        if finished:
            books_finished += 1
        progress = 0.0
        if pages > 0:
            progress = min(100.0, round((current_page / pages) * 100, 1))

        parsed_books.append(
            {
                "id": book_id,
                "title": book["title"],
                "authors": book["authors"],
                "pages": pages,
                "current_page": current_page,
                "progress_pct": progress,
                "last_read": _iso_datetime(last_read_ts, tz),
                "status": "finished" if finished else "reading",
            }
        )

        unique_count = len(unique_pages.get(book_id, set()))
        total_seconds = totals.get(book_id, 0)
        pace = (total_seconds / unique_count) if unique_count else None
        sessions = [
            {
                "date": day.isoformat(),
                "seconds": values["seconds"],
                "pages_read": values["pages_read"],
            }
            for day, values in sorted(daily_book.get(book_id, {}).items())
        ]
        book_stats[str(book_id)] = {
            "book_id": book_id,
            "title": book["title"],
            "total_seconds": total_seconds,
            "pace_seconds_per_page": round(pace, 1) if pace is not None else None,
            "sessions": sessions,
        }

    daily = [
        {"date": day.isoformat(), "seconds": seconds}
        for day, seconds in sorted(daily_all.items())
    ]
    weekly_map: dict[date, int] = defaultdict(int)
    for day, seconds in daily_all.items():
        weekly_map[_week_start(day)] += seconds
    weekly = [
        {"week_start": start.isoformat(), "seconds": seconds}
        for start, seconds in sorted(weekly_map.items())
    ]

    generated_at = now.isoformat()
    return {
        "generated_at": generated_at,
        "last_synced": generated_at,
        "stale": False,
        "last_error": None,
        "books": parsed_books,
        "summary": {
            "total_reading_seconds": sum(totals.values()),
            "streak_days": _streak_days(active_days, today),
            "pages_this_week": pages_this_week,
            "pages_this_month": pages_this_month,
            "books_finished": books_finished,
            "daily": daily,
            "weekly": weekly,
            "last_synced": generated_at,
            "stale": False,
            "last_error": None,
        },
        "book_stats": book_stats,
    }
