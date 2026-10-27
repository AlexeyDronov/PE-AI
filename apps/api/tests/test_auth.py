"""Access control (user request): two accounts set by the admin; 7-day sessions.

Guest can read and run agent jobs but not save changes (step 8.13).
"""

import pytest
from fastapi.testclient import TestClient

from app.core import auth as access
from app.core.config import Settings
from app.main import create_app
from tests.conftest import FakeAgentClient

ADMIN = {"username": "admin", "password": "admin-pass"}
GUEST = {"username": "guest", "password": "guest-pass"}


@pytest.fixture
def secured(settings: Settings) -> Settings:
    return settings.model_copy(
        update={"admin_password": "admin-pass", "guest_password": "guest-pass", "auth_secret": "s" * 32}
    )


@pytest.fixture
def client(secured: Settings):
    with TestClient(create_app(secured, agent_client=FakeAgentClient())) as c:
        yield c


def login(client, creds) -> dict[str, str]:
    r = client.post("/api/auth/login", json=creds)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def scenario(client, headers):
    deal = client.get("/api/deals", headers=headers).json()["items"][0]
    return {"deal_id": deal["id"], "name": "Bid", "case": "base", "overrides": {}}


def test_login_returns_a_seven_day_session(client):
    r = client.post("/api/auth/login", json=ADMIN)
    body = r.json()
    assert (body["username"], body["role"]) == ("admin", "admin")
    assert body["token"]
    assert client.post("/api/auth/login", json=GUEST).json()["role"] == "guest"
    assert access.SESSION_SECONDS == 7 * 24 * 3600


@pytest.mark.parametrize(
    "creds", [{"username": "admin", "password": "nope"}, {"username": "root", "password": "admin-pass"}]
)
def test_wrong_credentials_are_rejected(client, creds):
    r = client.post("/api/auth/login", json=creds)
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "unauthorized"


def test_data_needs_a_session(client):
    assert client.get("/api/deals").status_code == 401
    assert client.get("/api/overview-summary").status_code == 401
    assert client.get("/api/deals", headers={"Authorization": "Bearer junk"}).status_code == 401
    assert client.get("/api/health").status_code == 200


def test_me_reports_the_signed_in_account(client):
    headers = login(client, GUEST)
    assert client.get("/api/auth/me", headers=headers).json() == {
        "username": "guest",
        "role": "guest",
        "auth_enabled": True,
    }


def test_guest_can_read_and_model_but_not_save_changes(client):
    headers = login(client, GUEST)
    assert client.get("/api/deals", headers=headers).status_code == 200
    deal_id = scenario(client, headers)["deal_id"]
    assert client.post("/api/compute/lbo", json={"deal_id": deal_id}, headers=headers).status_code == 200
    r = client.post("/api/commands/save-scenario", json=scenario(client, headers), headers=headers)
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "forbidden"
    r = client.post("/api/commands/set-watchlist", json={"deal_id": deal_id, "on": True}, headers=headers)
    assert r.status_code == 403


# Step 8.13 (user request): guests may run research and the other agent jobs, and upload a teaser to screen.
def test_guest_can_run_agent_jobs_and_upload_a_teaser(client):
    headers = login(client, GUEST)
    r = client.post(
        "/api/commands/start-market-research", json={"question": "How big is UK TIC?"}, headers=headers
    )
    assert r.status_code == 202, r.text
    r = client.post("/api/commands/screen-teaser", json={"text": "Project Linden " * 30}, headers=headers)
    assert r.status_code == 202, r.text
    deal_id = client.get("/api/deals", headers=headers).json()["items"][0]["id"]
    r = client.post(
        "/api/commands/draft-memo", json={"deal_id": deal_id, "sections": ["summary"]}, headers=headers
    )
    assert r.status_code == 202, r.text
    r = client.post("/api/extract-text", files={"file": ("t.txt", b"hello", "text/plain")}, headers=headers)
    assert r.status_code == 200, r.text


def test_admin_can_write(client):
    headers = login(client, ADMIN)
    r = client.post("/api/commands/save-scenario", json=scenario(client, headers), headers=headers)
    assert r.status_code == 201, r.text


def test_tampered_and_expired_tokens_are_rejected(client, secured, monkeypatch):
    token = client.post("/api/auth/login", json=GUEST).json()["token"]
    payload, signature = token.split(".")
    forged = access.issue_token("guest", "admin", secured).split(".")[0] + "." + signature
    assert client.get("/api/deals", headers={"Authorization": f"Bearer {forged}"}).status_code == 401
    real_time = access.time.time
    monkeypatch.setattr(access.time, "time", lambda: real_time() + access.SESSION_SECONDS + 1)
    assert client.get("/api/deals", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_event_stream_accepts_the_token_as_a_query_parameter(client, secured):
    """EventSource can't send headers, so the stream takes ?access_token=."""
    assert client.get("/api/events?access_token=junk").status_code == 401
    token = client.post("/api/auth/login", json=GUEST).json()["token"]
    assert access.token_from(None, token) == token
    assert access.token_from(f"Bearer {token}", None) == token
    assert access.authenticate(token, secured) == access.User("guest", "guest")


def test_agent_callbacks_use_the_service_token_not_a_login(client, auth):
    r = client.post("/internal/jobs/missing/progress", json={"step": "x", "message": "y"}, headers=auth)
    assert r.status_code != 401


def test_cors_allows_the_authorization_header(client):
    r = client.options(
        "/api/deals",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )
    assert r.status_code == 200


def test_without_passwords_auth_is_off_for_local_development(settings):
    with TestClient(create_app(settings, agent_client=FakeAgentClient())) as c:
        assert c.get("/api/deals").status_code == 200
        assert c.get("/api/auth/me").json() == {"username": "local", "role": "admin", "auth_enabled": False}


def test_production_refuses_to_start_without_credentials(settings):
    with pytest.raises(ValueError, match="AUTH_REQUIRED"):
        Settings(
            database_path=settings.database_path, auth_required=True, admin_password=None, auth_secret=None
        )
    with pytest.raises(ValueError, match="AUTH_SECRET"):
        Settings(database_path=settings.database_path, guest_password="x", auth_secret=None)
