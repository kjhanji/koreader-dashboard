from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from app.config import Settings
from app.parser import SchemaError, empty_payload, parse_statistics_db
from app.webdav import WebDAVError, download_statistics_db

logger = logging.getLogger(__name__)


class StatsStore:
    """In-memory cache of parsed KOReader stats, refreshed from Koofr on demand."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self._lock = asyncio.Lock()
        self._payload = empty_payload(last_error="No stats loaded yet")
        self._fetched_at: datetime | None = None
        self._load_from_disk()

    def _now(self) -> datetime:
        return datetime.now(ZoneInfo(self.settings.timezone))

    def _load_from_disk(self) -> None:
        path = self.settings.snapshot_path
        if not path.exists():
            return
        try:
            payload = json.loads(path.read_text())
            payload["stale"] = True
            summary = dict(payload.get("summary") or {})
            summary["stale"] = True
            payload["summary"] = summary
            self._payload = payload
        except (OSError, json.JSONDecodeError) as exc:
            logger.warning("Could not load cached stats from disk: %s", exc)
            self._payload = empty_payload(last_error=f"Corrupt cache file: {exc}")

    def _write_disk(self, payload: dict[str, Any]) -> None:
        path = self.settings.snapshot_path
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(payload, indent=2))
        tmp.replace(path)

    def _mark_stale(self, error: str) -> None:
        payload = dict(self._payload)
        payload["stale"] = True
        payload["last_error"] = error
        summary = dict(payload.get("summary") or {})
        summary["stale"] = True
        summary["last_error"] = error
        if not summary.get("last_synced"):
            summary["last_synced"] = payload.get("last_synced")
        payload["summary"] = summary
        if not payload.get("generated_at"):
            payload["generated_at"] = self._now().isoformat()
        self._payload = payload
        try:
            self._write_disk(payload)
        except OSError as exc:
            logger.warning("Could not persist stale cache: %s", exc)

    def _cache_valid(self) -> bool:
        if self._fetched_at is None:
            return False
        if self._payload.get("stale"):
            return False
        age = self._now() - self._fetched_at
        return age < timedelta(seconds=self.settings.cache_ttl_seconds)

    @property
    def payload(self) -> dict[str, Any]:
        return self._payload

    def snapshot_exists(self) -> bool:
        return self.settings.snapshot_path.exists()

    async def get_fresh(self, force: bool = False) -> dict[str, Any]:
        if not force and self._cache_valid():
            return self._payload
        return await self.refresh(force=force)

    async def refresh(self, force: bool = False) -> dict[str, Any]:
        async with self._lock:
            if not force and self._cache_valid():
                return self._payload
            try:
                await download_statistics_db(self.settings, self.settings.db_path)
                payload = await asyncio.to_thread(
                    parse_statistics_db,
                    self.settings.db_path,
                    self.settings.timezone,
                )
                self._payload = payload
                self._fetched_at = self._now()
                self._write_disk(payload)
                logger.info("Stats refreshed at %s", payload.get("generated_at"))
                return payload
            except (WebDAVError, SchemaError, OSError, ValueError) as exc:
                logger.exception("Stats refresh failed")
                self._mark_stale(str(exc))
                return self._payload
