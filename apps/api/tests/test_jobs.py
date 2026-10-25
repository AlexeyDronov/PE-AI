"""One job pipeline for every LLM/agent task, exercised through market research."""

from app.jobs.registry import JOB_KINDS

REPORT = {
    "summary": "Outsourced KYC demand is growing about 11% a year.",
    "findings": [
        {
            "metric": "Market size",
            "value": 9.1,
            "unit": "£bn",
            "period": "2026",
            "confidence": "medium",
            "source_refs": [1],
        },
        {
            "metric": "CAGR 2026-30",
            "value": 11.0,
            "unit": "%",
            "period": "2026-30",
            "confidence": "low",
            "source_refs": [1, 2],
        },
    ],
    "sources": [
        {
            "ref": 1,
            "url": "https://example.org/a",
            "title": "Report A",
            "publisher": "Example",
            "excerpt": "The market reached £9.1bn.",
        },
        {
            "ref": 2,
            "url": "https://example.org/b",
            "title": "Report B",
            "publisher": "Example",
            "excerpt": "Growth of 11% is expected.",
        },
    ],
}


def start(client, segment_id=None):
    body = {"question": "How big is compliance outsourcing in the UK?", "segment_id": segment_id}
    r = client.post("/api/commands/start-market-research", json=body)
    assert r.status_code == 202, r.text
    return r.json()


def test_registry_has_kinds_used_by_the_product():
    assert {"market_research", "teaser_screen", "memo_draft"} <= set(JOB_KINDS)


def test_start_creates_queued_job_and_calls_agent(client, agent):
    job = start(client)
    assert job["kind"] == "market_research"
    assert job["status"] == "queued"
    assert agent.started == [
        {
            "kind": "market_research",
            "job_id": job["id"],
            "payload": {"question": "How big is compliance outsourcing in the UK?", "segment_id": None},
        }
    ]
    assert client.get(f"/api/jobs/{job['id']}").json()["status"] == "queued"


def test_progress_marks_job_running(client, auth):
    job = start(client)
    r = client.post(
        f"/internal/jobs/{job['id']}/progress",
        headers=auth,
        json={"step": "search", "message": "Running 6 queries"},
    )
    assert r.status_code == 204
    got = client.get(f"/api/jobs/{job['id']}").json()
    assert got["status"] == "running"
    assert got["progress"][-1]["step"] == "search"


def test_result_persists_report_and_succeeds(client, auth):
    seg = client.get("/api/segments").json()["items"][0]
    job = start(client, seg["id"])
    r = client.post(f"/internal/jobs/{job['id']}/result", headers=auth, json={"payload": REPORT})
    assert r.status_code == 204, r.text
    got = client.get(f"/api/jobs/{job['id']}").json()
    assert got["status"] == "succeeded"
    assert got["result_ref"]
    reports = client.get("/api/research-reports").json()
    assert reports["total"] == 1
    report = reports["items"][0]
    assert report["id"] == got["result_ref"]
    assert report["segment_id"] == seg["id"]
    assert report["source"] == "agent"
    findings = client.get("/api/research-findings", params={"report_id": report["id"]}).json()
    assert findings["total"] == 2
    assert client.get("/api/sources").json()["total"] == 2


def test_uncited_findings_are_rejected_and_fail_the_job(client, auth):
    job = start(client)
    bad = {**REPORT, "findings": [{**REPORT["findings"][0], "source_refs": []}]}
    r = client.post(f"/internal/jobs/{job['id']}/result", headers=auth, json={"payload": bad})
    assert r.status_code == 422
    got = client.get(f"/api/jobs/{job['id']}").json()
    assert got["status"] == "failed"
    assert got["error"]
    assert client.get("/api/research-reports").json()["total"] == 0


def test_findings_citing_unknown_sources_are_rejected(client, auth):
    job = start(client)
    bad = {**REPORT, "findings": [{**REPORT["findings"][0], "source_refs": [9]}]}
    assert (
        client.post(f"/internal/jobs/{job['id']}/result", headers=auth, json={"payload": bad}).status_code
        == 422
    )


def test_agent_can_report_failure(client, auth):
    job = start(client)
    r = client.post(f"/internal/jobs/{job['id']}/fail", headers=auth, json={"error": "Search quota exceeded"})
    assert r.status_code == 204
    got = client.get(f"/api/jobs/{job['id']}").json()
    assert (got["status"], got["error"]) == ("failed", "Search quota exceeded")


def test_finished_jobs_cannot_be_changed(client, auth):
    job = start(client)
    client.post(f"/internal/jobs/{job['id']}/result", headers=auth, json={"payload": REPORT})
    r = client.post(f"/internal/jobs/{job['id']}/progress", headers=auth, json={"step": "x", "message": "y"})
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "job_finished"


def test_internal_routes_require_service_token(client):
    job = start(client)
    url = f"/internal/jobs/{job['id']}/progress"
    assert client.post(url, json={"step": "s", "message": "m"}).status_code == 401
    assert (
        client.post(
            url, headers={"Authorization": "Bearer wrong"}, json={"step": "s", "message": "m"}
        ).status_code
        == 401
    )


def test_unknown_job_is_404(client, auth):
    r = client.post("/internal/jobs/nope/progress", headers=auth, json={"step": "s", "message": "m"})
    assert r.status_code == 404


def test_job_lifecycle_publishes_events(app, client, auth):
    import asyncio

    queue = app.state.events.subscribe()
    job = start(client)
    client.post(f"/internal/jobs/{job['id']}/progress", headers=auth, json={"step": "search", "message": "m"})
    client.post(f"/internal/jobs/{job['id']}/result", headers=auth, json={"payload": REPORT})

    events = []
    while not queue.empty():
        events.append(asyncio.run(queue.get()))
    job_events = [e for e in events if e["type"] == "job"]
    assert [e["status"] for e in job_events] == ["queued", "running", "succeeded"]
    changed = [e for e in events if e["type"] == "changed"]
    assert any("research-reports" in e["resources"] for e in changed)
