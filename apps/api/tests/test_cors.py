"""The browser app on another port can call the API."""


def test_preflight_from_web_app_is_allowed(client):
    r = client.options(
        "/api/commands/save-scenario",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert r.status_code == 200
    assert r.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_unknown_origin_is_not_allowed(client):
    r = client.get("/api/health", headers={"Origin": "http://evil.example"})
    assert "access-control-allow-origin" not in r.headers
