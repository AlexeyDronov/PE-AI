from pathlib import Path

from pydantic import field_validator, model_validator
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
    # Access control: off until a password is set (local dev, tests); production sets AUTH_REQUIRED.
    admin_username: str = "admin"
    admin_password: str | None = None
    guest_username: str = "guest"
    guest_password: str | None = None
    auth_secret: str | None = None
    auth_required: bool = False

    @property
    def auth_enabled(self) -> bool:
        return bool(self.admin_password or self.guest_password)

    @model_validator(mode="after")
    def _auth_complete(self) -> "Settings":
        if self.auth_required and not (self.admin_password and self.auth_secret):
            raise ValueError("AUTH_REQUIRED is set but ADMIN_PASSWORD or AUTH_SECRET is missing")
        if self.auth_enabled and not self.auth_secret:
            raise ValueError("A password is set but AUTH_SECRET (used to sign sessions) is missing")
        return self

    @field_validator("database_path")
    @classmethod
    def _absolute(cls, path: Path) -> Path:
        return path if path.is_absolute() else REPO_ROOT / path
