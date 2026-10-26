"""6.12-6.14: read endpoints the agent pages need, so the web assembles nothing itself (R1)."""

from tests.test_jobs import REPORT, start


def test_research_report_detail_has_findings_with_numbered_sources(client, auth):
    job = start(client)
    client.post(f"/internal/jobs/{job['id']}/result", headers=auth, json={"payload": REPORT})
    report_id = client.get(f"/api/jobs/{job['id']}").json()["result_ref"]

    detail = client.get(f"/api/research-reports/{report_id}").json()
    assert detail["summary"] == REPORT["summary"]
    assert [s["ref"] for s in detail["sources"]] == [1, 2]
    assert [s["url"] for s in detail["sources"]] == ["https://example.org/a", "https://example.org/b"]
    assert {"title", "publisher", "excerpt", "retrieved_at"} <= set(detail["sources"][0])
    by_metric = {f["metric"]: f for f in detail["findings"]}
    assert by_metric["Market size"]["refs"] == [1]
    assert by_metric["CAGR 2026-30"]["refs"] == [1, 2]
    assert by_metric["Market size"]["confidence"] == "medium"
    assert (by_metric["Market size"]["value"], by_metric["Market size"]["unit"]) == (9.1, "£bn")


def test_research_reports_list_newest_first(client, auth):
    for question in ("First question about KYC", "Second question about KYC"):
        job = client.post("/api/commands/start-market-research", json={"question": question}).json()
        payload = {**REPORT, "summary": question}
        client.post(f"/internal/jobs/{job['id']}/result", headers=auth, json={"payload": payload})
    items = client.get("/api/research-reports", params={"sort": "-created_at"}).json()["items"]
    assert [r["question"] for r in items][:2] == ["Second question about KYC", "First question about KYC"]


def test_memo_outline_lists_sections_with_labels(client):
    outline = client.get("/api/memo-outline").json()
    assert [s["key"] for s in outline["sections"]] == [
        "summary",
        "thesis",
        "market",
        "financials",
        "valuation",
        "risks",
        "recommendation",
    ]
    assert all(s["label"] and s["description"] for s in outline["sections"])
    assert outline["sections"][1]["label"] == "Investment thesis"


def test_memo_detail_orders_sections_by_the_outline(client, auth):
    deal = client.get("/api/deals").json()["items"][0]
    keys = ["recommendation", "summary", "risks"]
    job = client.post(
        "/api/commands/draft-memo", json={"deal_id": deal["id"], "scenario_id": None, "sections": keys}
    ).json()
    sections = [{"key": k, "markdown": f"## {k}\n\nText."} for k in keys]
    client.post(f"/internal/jobs/{job['id']}/result", headers=auth, json={"payload": {"sections": sections}})
    memo_id = client.get(f"/api/jobs/{job['id']}").json()["result_ref"]

    memo = client.get(f"/api/memos/{memo_id}").json()
    assert memo["deal_id"] == deal["id"]
    assert memo["scenario_name"] is None
    assert [s["key"] for s in memo["sections"]] == ["summary", "risks", "recommendation"]
    assert [s["label"] for s in memo["sections"]] == ["Summary", "Risks", "Recommendation"]
    assert all(s["status"] == "draft" and s["markdown"] for s in memo["sections"])


def test_memo_detail_names_the_scenario(client, auth):
    deal = client.get("/api/deals").json()["items"][0]
    saved = client.post(
        "/api/commands/save-scenario",
        json={"deal_id": deal["id"], "name": "Downside", "case": "down", "overrides": {}},
    ).json()
    job = client.post(
        "/api/commands/draft-memo",
        json={"deal_id": deal["id"], "scenario_id": saved["id"], "sections": ["summary"]},
    ).json()
    payload = {"sections": [{"key": "summary", "markdown": "## Summary\n\nText."}]}
    client.post(f"/internal/jobs/{job['id']}/result", headers=auth, json={"payload": payload})
    memo_id = client.get(f"/api/jobs/{job['id']}").json()["result_ref"]
    assert client.get(f"/api/memos/{memo_id}").json()["scenario_name"] == "Downside"


def test_latest_memo_for_a_deal_comes_first(client, auth):
    deal = client.get("/api/deals").json()["items"][0]
    for text in ("old", "new"):
        job = client.post(
            "/api/commands/draft-memo",
            json={"deal_id": deal["id"], "scenario_id": None, "sections": ["summary"]},
        ).json()
        payload = {"sections": [{"key": "summary", "markdown": f"## Summary\n\n{text}"}]}
        client.post(f"/internal/jobs/{job['id']}/result", headers=auth, json={"payload": payload})
    memos = client.get("/api/memos", params={"deal_id": deal["id"], "sort": "-created_at"}).json()["items"]
    latest = client.get(f"/api/memos/{memos[0]['id']}").json()
    assert latest["sections"][0]["markdown"].endswith("new")
