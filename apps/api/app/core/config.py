from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

API_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = API_ROOT.parents[1]


class Settings(BaseSettings):
    """Runtime configuration, read from the environment and the repo-root .env (names as in .env.example)."""

    model_config = SettingsConfigDict(env_file=REPO_ROOT / ".env", extra="ignore")

    database_path: Path = API_ROOT / "data" / "harrowgate.sqlite"
    agent_url: str = "http://localhost:4111"
    agent_service_token: str = "dev-service-token"
    cors_origins: list[str] = ["http://localhost:3000"]

    @field_validator("database_path")
    @classmethod
    def _absolute(cls, path: Path) -> Path:
        return path if path.is_absolute() else REPO_ROOT / path
