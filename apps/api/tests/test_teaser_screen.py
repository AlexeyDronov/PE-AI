"""7.5: screen a teaser. The agent extracts facts; the API validates, persists and scores them."""

import copy

TEASER = (
    "Project Birch: a founder-owned UK provider of payroll outsourcing to mid-sized employers. "
    "FY26 revenue £48m, EBITDA £9.6m, growing 14% a year with 82% recurring revenue."
)

RESULT = {
    "company": {
        "name": "Birchfield Payroll",
        "description": "Payroll outsourcing for UK mid-sized employers.",
        "hq": "Manchester",
        "ownership": "Founder-owned",
        "moat": "Multi-year contracts and embedded HR integrations",
    },
    "segment": "Payroll BPO",
    "code_name": "Project Birch",
    "process": "Teaser circulated by adviser",
    "ask_multiple": 12.0,
    "financials": {
        "revenue": 48.0,
        "ebitda": 9.6,
        "growth": 0.14,
        "recurring_pct": 0.82,
        "capex_pct": 0.03,
        "da_pct": 0.04,
        "nwc_pct": 0.05,
        "top_customer_pct": 0.07,
        "gross_retention": 0.94,
        "cyclicality": "Low",
        "ai_resilience": 55,
        "fragmentation": 70,
        "key_person_risk": True,
    },
    "risk_flags": [
        {"severity": "m", "text": "Founder runs sales", "mitigant": "Hire a CRO pre-close"},
        {"severity": "l", "text": "Pricing below peers", "mitigant": "Price review in 100-day plan"},
    ],
    "diligence_questions": [
        "What share of revenue is on multi-year contracts?",
        "How many clients churned in FY26?",
    ],
}


def screen(client, text=TEASER):
    r = client.post("/api/commands/screen-teaser", json={"text": text})
    assert r.status_code == 202, r.text
    return r.json()


def post_result(client, auth, job, payload):
    return client.post(f"/internal/jobs/{job['id']}/result", headers=auth, json={"payload": payload})


def test_screen_teaser_queues_a_job_and_starts_the_agent(client, agent):
    job = screen(client)
    assert (job["kind"], job["status"]) == ("teaser_screen", "queued")
    assert agent.started[-1] == {"kind": "teaser_screen", "job_id": job["id"], "payload": {"text": TEASER}}


def test_screen_teaser_rejects_empty_and_oversized_text(client):
    assert client.post("/api/commands/screen-teaser", json={"text": ""}).status_code == 422
    assert client.post("/api/commands/screen-teaser", json={"text": "x" * 40_001}).status_code == 422


def test_result_creates_a_scored_teaser_deal(client, auth):
    before = client.get("/api/deals").json()["total"]
    job = screen(client)
    r = post_result(client, auth, job, RESULT)
    assert r.status_code == 204, r.text

    got = client.get(f"/api/jobs/{job['id']}").json()
    assert got["status"] == "succeeded"
    deal = client.get(f"/api/deals/{got['result_ref']}").json()
    assert client.get("/api/deals").json()["total"] == before + 1
    assert (deal["stage"], deal["origin"], deal["source"]) == ("Teaser", "teaser", "agent")
    assert deal["code_name"] == "Project Birch"
    assert deal["ask_multiple"] == 12.0
    assert deal["company"]["name"] == "Birchfield Payroll"
    assert deal["segment"]["short"] == "Payroll BPO"
    assert deal["financials"]["revenue"] == 48.0
    assert deal["financials"]["key_person_risk"] is True
    assert deal["screening"]["verdict"] in ("Advance", "Watch", "Pass")
    assert 0 <= deal["screening"]["score"] <= 100
    assert [f["text"] for f in deal["flags"]] == ["Founder runs sales", "Pricing below peers"]
    assert deal["questions"] == RESULT["diligence_questions"]

    teasers = client.get("/api/teasers").json()["items"]
    assert [(t["raw_text"], t["job_id"], t["deal_id"]) for t in teasers] == [(TEASER, job["id"], deal["id"])]


def test_missing_ask_multiple_defaults_to_the_segment_median(client, auth):
    seg = next(s for s in client.get("/api/segments").json()["items"] if s["short"] == "Payroll BPO")
    job = screen(client)
    assert post_result(client, auth, job, {**RESULT, "ask_multiple": None}).status_code == 204
    deal_id = client.get(f"/api/jobs/{job['id']}").json()["result_ref"]
    assert client.get(f"/api/deals/{deal_id}").json()["ask_multiple"] == seg["median_multiple"]


def test_unknown_segment_is_rejected_and_fails_the_job(client, auth):
    before = client.get("/api/deals").json()["total"]
    job = screen(client)
    r = post_result(client, auth, job, {**RESULT, "segment": "Space tourism"})
    assert r.status_code == 422
    got = client.get(f"/api/jobs/{job['id']}").json()
    assert got["status"] == "failed"
    assert "segment" in got["error"].lower()
    assert client.get("/api/deals").json()["total"] == before


def bad(**financials):
    payload = copy.deepcopy(RESULT)
    payload["financials"].update(financials)
    return payload


def test_out_of_range_figures_are_rejected(client, auth):
    for payload in (
        bad(ebitda=60.0),  # EBITDA above revenue
        bad(revenue=0.0),
        bad(ebitda=0.0),
        bad(recurring_pct=82),  # a percentage, not a fraction
        bad(growth=3.0),
        bad(ai_resilience=140),
        bad(cyclicality="Very high"),
    ):
        job = screen(client)
        assert post_result(client, auth, job, payload).status_code == 422, payload["financials"]


def test_flags_and_questions_are_bounded(client, auth):
    flag = RESULT["risk_flags"][0]
    for payload in (
        {**RESULT, "risk_flags": [{**flag, "severity": "critical"}]},
        {**RESULT, "risk_flags": [flag] * 9},
        {**RESULT, "diligence_questions": []},
        {**RESULT, "diligence_questions": ["q?"] * 11},
    ):
        job = screen(client)
        assert post_result(client, auth, job, payload).status_code == 422


def test_success_broadcasts_deal_changes(app, client, auth):
    import asyncio

    queue = app.state.events.subscribe()
    job = screen(client)
    post_result(client, auth, job, RESULT)
    events = []
    while not queue.empty():
        events.append(asyncio.run(queue.get()))
    changed = [e for e in events if e["type"] == "changed"]
    assert any("deals" in e["resources"] for e in changed)
