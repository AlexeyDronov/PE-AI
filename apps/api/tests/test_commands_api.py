"""The only write path: POST /api/commands/{name}, followed by a live 'changed' event."""

import asyncio

from app.commands import COMMANDS


def scenario(client):
    deal = client.get("/api/deals").json()["items"][0]
    return {"deal_id": deal["id"], "name": "Bid at 15x", "case": "base", "overrides": {}}


def test_registry_contains_commands():
    names = {c.name for c in COMMANDS}
    assert {"save-scenario", "set-watchlist", "start-market-research"} <= names


def test_every_command_declares_what_it_invalidates():
    for c in COMMANDS:
        assert c.invalidates, c.name


def test_invalid_input_is_422_with_error_shape(client):
    r = client.post("/api/commands/save-scenario", json={"name": "x"})
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
    body = scenario(client)
    created = client.post("/api/commands/save-scenario", json=body).json()
    event = asyncio.run(asyncio.wait_for(_next(queue), 1))
    assert event == {"type": "changed", "resources": ["lbo-scenarios"], "ids": [created["id"]]}
    bus.unsubscribe(queue)


def test_failed_command_publishes_nothing(app, client):
    queue = app.state.events.subscribe()
    client.post("/api/commands/save-scenario", json={})
    assert queue.empty()


async def _next(queue):
    return await queue.get()
