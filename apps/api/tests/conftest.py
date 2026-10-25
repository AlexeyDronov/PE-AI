"""Shared fixtures. Every test gets its own freshly seeded SQLite file."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from seed.seed import build_database

SERVICE_TOKEN = "test-service-token"


class FakeAgentClient:
    """Stands in for the Mastra service. Records every job start."""

    def __init__(self) -> None:
        self.started: list[dict] = []

    async def start_job(self, kind: str, job_id: str, payload: dict) -> None:
        self.started.append({"kind": kind, "job_id": job_id, "payload": payload})


@pytest.fixture
def db_path(tmp_path: Path) -> Path:
    path = tmp_path / "harrowgate.sqlite"
    build_database(path)
    return path


@pytest.fixture
def settings(db_path: Path) -> Settings:
    return Settings(
        database_path=db_path,
        agent_url="http://agent.invalid",
        agent_service_token=SERVICE_TOKEN,
    )


@pytest.fixture
def agent() -> FakeAgentClient:
    return FakeAgentClient()


@pytest.fixture
def app(settings: Settings, agent: FakeAgentClient):
    return create_app(settings, agent_client=agent)


@pytest.fixture
def client(app):
    with TestClient(app) as c:
        yield c


@pytest.fixture
def auth() -> dict[str, str]:
    return {"Authorization": f"Bearer {SERVICE_TOKEN}"}
