"""The only write path: POST /api/commands/{name}, followed by a live 'changed' event."""

import asyncio

from app.commands import COMMANDS

ANNOTATION = {
    "route": "/deals",
    "selector": "[data-testid=pipeline-table]",
    "note": "Score column is too narrow",
    "rect": {"x": 10, "y": 20, "w": 300, "h": 40},
    "viewport": {"w": 1440, "h": 900},
    "theme": "light",
}


def test_registry_contains_commands():
    names = {c.name for c in COMMANDS}
    assert {"create-annotation", "update-annotation", "start-market-research"} <= names


def test_every_command_declares_what_it_invalidates():
    for c in COMMANDS:
        assert c.invalidates, c.name


def test_create_annotation_then_read_it_back(client):
    r = client.post("/api/commands/create-annotation", json=ANNOTATION)
    assert r.status_code == 201, r.text
    created = r.json()
    assert created["id"]
    assert created["status"] == "open"
    assert created["note"] == ANNOTATION["note"]
    listed = client.get("/api/annotations", params={"status": "open"}).json()
    assert [a["id"] for a in listed["items"]] == [created["id"]]


def test_update_annotation(client):
    created = client.post("/api/commands/create-annotation", json=ANNOTATION).json()
    r = client.post("/api/commands/update-annotation", json={"id": created["id"], "status": "resolved"})
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "resolved"
    assert client.get("/api/annotations", params={"status": "open"}).json()["total"] == 0


def test_update_unknown_annotation_is_404(client):
    r = client.post("/api/commands/update-annotation", json={"id": "nope", "status": "resolved"})
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "not_found"


def test_invalid_input_is_422_with_error_shape(client):
    r = client.post("/api/commands/create-annotation", json={"route": "/deals"})
    assert r.status_code == 422
    body = r.json()["error"]
    assert body["code"] == "validation_error"
    assert body["details"]


def test_unknown_command_is_404(client):
    r = client.post("/api/commands/launch-rockets", json={})
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "unknown_command"


def test_successful_command_publishes_changed_event(app, client):
    bus = app.state.events
    queue = bus.subscribe()
    created = client.post("/api/commands/create-annotation", json=ANNOTATION).json()
    event = asyncio.run(asyncio.wait_for(_next(queue), 1))
    assert event == {"type": "changed", "resources": ["annotations"], "ids": [created["id"]]}
    bus.unsubscribe(queue)


def test_failed_command_publishes_nothing(app, client):
    queue = app.state.events.subscribe()
    client.post("/api/commands/create-annotation", json={})
    assert queue.empty()


async def _next(queue):
    return await queue.get()
