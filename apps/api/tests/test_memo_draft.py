"""7.7: draft an IC memo. The API builds a compact deal + model summary; the agent writes the prose."""

import pytest

SECTIONS = ["summary", "thesis", "risks", "recommendation"]


@pytest.fixture
def deal(client):
    return client.get("/api/deals").json()["items"][0]


def draft(client, deal_id, sections=SECTIONS, scenario_id=None):
    return client.post(
        "/api/commands/draft-memo",
        json={"deal_id": deal_id, "scenario_id": scenario_id, "sections": sections},
    )


def test_memo_sections_are_a_fixed_known_list(client):
    from app.jobs.memo_draft import MEMO_SECTIONS

    assert list(MEMO_SECTIONS) == [
        "summary",
        "thesis",
        "market",
        "financials",
        "valuation",
        "risks",
        "recommendation",
    ]


def test_draft_memo_queues_a_job_with_a_compact_context(client, agent, deal):
    r = draft(client, deal["id"])
    assert r.status_code == 202, r.text
    job = r.json()
    assert (job["kind"], job["status"]) == ("memo_draft", "queued")
    sent = agent.started[-1]
    assert sent["kind"] == "memo_draft"
    payload = sent["payload"]
    assert (payload["deal_id"], payload["scenario_id"], payload["sections"]) == (deal["id"], None, SECTIONS)

    ctx = payload["context"]
    assert ctx["deal"]["code_name"] == deal["code_name"]
    assert ctx["deal"]["company"] == deal["company"]["name"]
    assert ctx["deal"]["segment"] == deal["segment"]["name"]
    assert ctx["screening"]["score"] == deal["screening"]["score"]
    assert ctx["screening"]["verdict"] == deal["screening"]["verdict"]
    assert ctx["financials"]["revenue"] == deal["financials"]["revenue"]
    assert {"severity", "text", "mitigant"} <= set(ctx["flags"][0])
    assert ctx["questions"]

    lbo = client.post("/api/compute/lbo", json={"deal_id": deal["id"]}).json()
    assert ctx["lbo"]["case"] == "base"
    assert ctx["lbo"]["returns"]["irr"] == pytest.approx(lbo["returns"]["irr"])
    assert ctx["lbo"]["returns"]["moic"] == pytest.approx(lbo["returns"]["moic"])
    assert ctx["lbo"]["hurdle"] == pytest.approx(lbo["hurdle"])
    assert ctx["lbo"]["assumptions"]["entry_multiple"] == pytest.approx(lbo["assumptions"]["entry_multiple"])
    assert "schedule" not in ctx["lbo"]  # compact: no year-by-year tables

    grid = client.post("/api/compute/lbo-sensitivity", json={"deal_id": deal["id"]}).json()
    flat = [v for row in grid["irr"] for v in row]
    assert ctx["sensitivity"]["irr_min"] == pytest.approx(min(flat))
    assert ctx["sensitivity"]["irr_max"] == pytest.approx(max(flat))
    assert ctx["debt_capacity"]["max_leverage"] > 0


def test_draft_memo_uses_the_saved_scenario(client, agent, deal):
    saved = client.post(
        "/api/commands/save-scenario",
        json={"deal_id": deal["id"], "name": "Downside", "case": "down", "overrides": {"exit_multiple": 9.0}},
    ).json()
    assert draft(client, deal["id"], scenario_id=saved["id"]).status_code == 202
    ctx = agent.started[-1]["payload"]["context"]
    lbo = client.post(
        "/api/compute/lbo", json={"deal_id": deal["id"], "case": "down", "overrides": {"exit_multiple": 9.0}}
    ).json()
    assert ctx["lbo"]["case"] == "down"
    assert ctx["lbo"]["scenario"] == "Downside"
    assert ctx["lbo"]["returns"]["irr"] == pytest.approx(lbo["returns"]["irr"])


def test_draft_memo_validates_its_input(client, deal):
    other = client.get("/api/deals").json()["items"][1]
    saved = client.post(
        "/api/commands/save-scenario",
        json={"deal_id": other["id"], "name": "Other", "case": "base", "overrides": {}},
    ).json()
    assert draft(client, "nope").status_code == 404
    assert draft(client, deal["id"], sections=[]).status_code == 422
    assert draft(client, deal["id"], sections=["summary", "poetry"]).status_code == 422
    assert draft(client, deal["id"], sections=["summary", "summary"]).status_code == 422
    assert draft(client, deal["id"], scenario_id="nope").status_code == 404
    assert draft(client, deal["id"], scenario_id=saved["id"]).status_code == 422  # another deal's scenario


def memo_result(sections=SECTIONS):
    return {"sections": [{"key": k, "markdown": f"## {k.title()}\n\nText for {k}."} for k in sections]}


def test_result_persists_the_memo_and_its_sections(client, auth, deal):
    job = draft(client, deal["id"]).json()
    r = client.post(f"/internal/jobs/{job['id']}/result", headers=auth, json={"payload": memo_result()})
    assert r.status_code == 204, r.text
    got = client.get(f"/api/jobs/{job['id']}").json()
    assert got["status"] == "succeeded"
    memo = client.get(f"/api/memos/{got['result_ref']}").json()
    assert (memo["deal_id"], memo["status"], memo["source"]) == (deal["id"], "draft", "agent")
    sections = client.get("/api/memo-sections", params={"memo_id": memo["id"]}).json()["items"]
    assert sorted(s["key"] for s in sections) == sorted(SECTIONS)
    assert all(s["status"] == "draft" and s["markdown"].startswith("## ") for s in sections)


def test_result_must_cover_exactly_the_requested_sections(client, auth, deal):
    for payload in (
        memo_result(SECTIONS[:2]),
        memo_result([*SECTIONS, "market"]),
        {"sections": [{"key": k, "markdown": ""} for k in SECTIONS]},
        {"sections": [{"key": k, "markdown": "x" * 8001} for k in SECTIONS]},
    ):
        job = draft(client, deal["id"]).json()
        r = client.post(f"/internal/jobs/{job['id']}/result", headers=auth, json={"payload": payload})
        assert r.status_code == 422
        assert client.get(f"/api/jobs/{job['id']}").json()["status"] == "failed"
    assert client.get("/api/memos", params={"deal_id": deal["id"]}).json()["total"] == 0


def test_memo_success_broadcasts_memo_changes(app, client, auth, deal):
    import asyncio

    queue = app.state.events.subscribe()
    job = draft(client, deal["id"]).json()
    client.post(f"/internal/jobs/{job['id']}/result", headers=auth, json={"payload": memo_result()})
    events = []
    while not queue.empty():
        events.append(asyncio.run(queue.get()))
    assert any("memos" in e["resources"] for e in events if e["type"] == "changed")
