"""Plan step 2.8a: a deal can be put on and taken off the watchlist; deals report it."""


def first_deal(client):
    return client.get("/api/deals").json()["items"][0]


def test_deals_start_unwatched(client):
    assert all(d["watchlisted"] is False for d in client.get("/api/deals").json()["items"])


def test_set_and_clear_watchlist(client):
    d = first_deal(client)
    r = client.post(
        "/api/commands/set-watchlist", json={"deal_id": d["id"], "on": True, "note": "Revisit after CIM"}
    )
    assert r.status_code == 200, r.text
    assert r.json() == {"deal_id": d["id"], "on": True, "note": "Revisit after CIM"}
    assert client.get(f"/api/deals/{d['id']}").json()["watchlisted"] is True
    assert client.get("/api/watchlist-entries").json()["total"] == 1

    r = client.post("/api/commands/set-watchlist", json={"deal_id": d["id"], "on": False})
    assert r.json()["on"] is False
    assert client.get(f"/api/deals/{d['id']}").json()["watchlisted"] is False
    assert client.get("/api/watchlist-entries").json()["total"] == 0


def test_setting_twice_is_idempotent(client):
    d = first_deal(client)
    for _ in range(2):
        client.post("/api/commands/set-watchlist", json={"deal_id": d["id"], "on": True})
    assert client.get("/api/watchlist-entries").json()["total"] == 1


def test_unknown_deal_is_404(client):
    r = client.post("/api/commands/set-watchlist", json={"deal_id": "nope", "on": True})
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "not_found"


def test_watchlist_changes_refresh_deals_live(app, client):
    import asyncio

    q = app.state.events.subscribe()
    d = first_deal(client)
    client.post("/api/commands/set-watchlist", json={"deal_id": d["id"], "on": True})
    events = []
    while not q.empty():
        events.append(asyncio.run(q.get()))
    changed = [e for e in events if e["type"] == "changed"]
    assert changed and "deals" in changed[-1]["resources"]
    assert d["id"] in changed[-1]["ids"]
