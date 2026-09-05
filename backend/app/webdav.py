from pathlib import Path

import httpx

from app.config import Settings


class WebDAVError(Exception):
    pass


async def download_statistics_db(settings: Settings, dest: Path) -> None:
    if not settings.webdav_username or not settings.webdav_password:
        raise WebDAVError("WEBDAV_USERNAME and WEBDAV_PASSWORD are required")

    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(".sqlite3.tmp")

    try:
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            response = await client.get(
                settings.webdav_file_url,
                auth=(settings.webdav_username, settings.webdav_password),
            )
    except httpx.HTTPError as exc:
        raise WebDAVError(f"Failed to download statistics database: {exc}") from exc

    if response.status_code == 404:
        raise WebDAVError(f"File not found at {settings.webdav_file_url}")
    if response.status_code in (401, 403):
        raise WebDAVError("WebDAV rejected the credentials")
    if response.status_code >= 400:
        raise WebDAVError(
            f"WebDAV returned HTTP {response.status_code} for {settings.webdav_file_url}"
        )

    tmp.write_bytes(response.content)
    tmp.replace(dest)
