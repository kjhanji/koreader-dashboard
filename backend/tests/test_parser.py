import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from app.parser import parse_statistics_db

TZ = ZoneInfo("America/Los_Angeles")


def _unix(dt: datetime) -> int:
    return int(dt.timestamp())


def _create_db(path: Path) -> None:
    conn = sqlite3.connect(path)
    conn.executescript(
        """
        CREATE TABLE book (
            id integer PRIMARY KEY,
            title text,
            authors text,
            pages integer,
            last_open integer
        );
        CREATE TABLE page_stat_data (
            id_book integer,
            page integer NOT NULL DEFAULT 0,
            start_time integer NOT NULL DEFAULT 0,
            duration integer NOT NULL DEFAULT 0,
            total_pages integer NOT NULL DEFAULT 0
        );
        """
    )

    now = datetime.now(TZ).replace(hour=12, minute=0, second=0, microsecond=0)
    yesterday = now - timedelta(days=1)
    last_week = now - timedelta(days=8)

    # Book 1 is in progress. A later re-read of page 2 must not become current page.
    conn.execute(
        "INSERT INTO book VALUES (1, 'In Progress', 'Author A', 200, ?)",
        (_unix(now),),
    )
    conn.executemany(
        "INSERT INTO page_stat_data VALUES (?, ?, ?, ?, 200)",
        [
            (1, 2, _unix(last_week), 30),
            (1, 10, _unix(yesterday), 40),
            (1, 11, _unix(now), 50),
            (1, 2, _unix(now) + 1, 20),
        ],
    )

    # Book 2 is finished: latest session is on the last page.
    conn.execute(
        "INSERT INTO book VALUES (2, 'Done', 'Author B', 10, ?)",
        (_unix(yesterday),),
    )
    conn.executemany(
        "INSERT INTO page_stat_data VALUES (?, ?, ?, ?, 10)",
        [
            (2, 9, _unix(yesterday) - 60, 25),
            (2, 10, _unix(yesterday), 35),
        ],
    )
    conn.commit()
    conn.close()


def test_current_page_uses_latest_session_not_max_page(tmp_path: Path):
    db_path = tmp_path / "statistics.sqlite3"
    _create_db(db_path)

    payload = parse_statistics_db(db_path, "America/Los_Angeles")
    by_id = {book["id"]: book for book in payload["books"]}

    assert by_id[1]["current_page"] == 2
    assert by_id[1]["status"] == "reading"
    assert by_id[1]["progress_pct"] == 1.0

    assert by_id[2]["current_page"] == 10
    assert by_id[2]["status"] == "finished"
    assert payload["summary"]["books_finished"] == 1
    assert payload["summary"]["streak_days"] >= 1
    assert payload["book_stats"]["1"]["total_seconds"] == 140
