from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    webdav_url: str = "https://app.koofr.net/dav/Koofr"
    webdav_username: str = ""
    webdav_password: str = ""
    koreader_db_path: str = "/readingStats/statistics.sqlite3"
    cache_ttl_seconds: int = 30
    timezone: str = "America/Los_Angeles"
    data_dir: Path = Path("./data")

    @property
    def snapshot_path(self) -> Path:
        return self.data_dir / "snapshot.json"

    @property
    def db_path(self) -> Path:
        return self.data_dir / "statistics.sqlite3"

    @property
    def webdav_file_url(self) -> str:
        base = self.webdav_url.rstrip("/")
        path = self.koreader_db_path
        if not path.startswith("/"):
            path = f"/{path}"
        return f"{base}{path}"


settings = Settings()
