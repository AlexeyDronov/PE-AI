"""Settings use the same variable names as .env.example."""

from pathlib import Path

from app.core.config import Settings


def test_reads_plain_env_names(monkeypatch, tmp_path):
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "x.sqlite"))
    monkeypatch.setenv("AGENT_URL", "http://agent.example:4111")
    monkeypatch.setenv("AGENT_SERVICE_TOKEN", "secret")
    s = Settings(_env_file=None)
    assert s.database_path == tmp_path / "x.sqlite"
    assert s.agent_url == "http://agent.example:4111"
    assert s.agent_service_token == "secret"


def test_defaults_match_the_dev_ports(monkeypatch):
    for name in ("DATABASE_PATH", "AGENT_URL", "AGENT_SERVICE_TOKEN"):
        monkeypatch.delenv(name, raising=False)
    s = Settings(_env_file=None)
    assert s.agent_url == "http://localhost:4111"
    assert s.database_path.name == "harrowgate.sqlite"


def test_relative_database_path_resolves_from_repo_root(monkeypatch):
    monkeypatch.setenv("DATABASE_PATH", "apps/api/data/harrowgate.sqlite")
    s = Settings(_env_file=None)
    assert s.database_path.is_absolute()
    assert s.database_path.parts[-4:] == ("apps", "api", "data", "harrowgate.sqlite")
    assert (s.database_path.parents[3] / "apps" / "api").is_dir()


def test_ignores_unrelated_env_entries(tmp_path):
    env = tmp_path / ".env"
    env.write_text("OPENROUTER_API_KEY=abc\nTAVILY_API_KEY=def\n")
    Settings(_env_file=env)  # must not raise on keys the API doesn't use


def test_cors_allows_the_web_app_by_default():
    assert "http://localhost:3000" in Settings(_env_file=None).cors_origins


def test_paths_are_paths():
    assert isinstance(Settings(_env_file=None).database_path, Path)
