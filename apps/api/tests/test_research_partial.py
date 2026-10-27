"""8.11: a report the sources only partly answer is stored as "partial", and the report records its model."""

import pytest

REPORT = {
    "summary": "The closest evidence is the market size; no deal multiple is disclosed.",
    "findings": [
        {
            "metric": "Market size",
            "value": 9.1,
            "unit": "£bn",
            "period": "2026",
            "confidence": "medium",
            "source_refs": [1],
        }
    ],
    "sources": [
        {
            "ref": 1,
            "url": "https://example.org/a",
            "title": "Report A",
            "publisher": "Example",
            "excerpt": "The market reached £9.1bn.",
        }
    ],
}


def run(client, auth, payload):
    body = {"question": "What multiples are paid for UK compliance outsourcers?", "segment_id": None}
    job = client.post("/api/commands/start-market-research", json=body).json()
    r = client.post(f"/internal/jobs/{job['id']}/result", headers=auth, json={"payload": payload})
    assert r.status_code == 204, r.text
    report_id = client.get(f"/api/jobs/{job['id']}").json()["result_ref"]
    return client.get(f"/api/research-reports/{report_id}").json()


@pytest.mark.parametrize(
    ("extra", "status"),
    [({"answered": False}, "partial"), ({"answered": True}, "complete"), ({}, "complete")],
)
def test_status_follows_whether_the_question_was_answered(client, auth, extra, status):
    report = run(client, auth, {**REPORT, **extra})
    assert report["status"] == status
    listed = client.get("/api/research-reports").json()["items"]
    assert [r["status"] for r in listed if r["id"] == report["id"]] == [status]


def test_the_model_that_wrote_the_report_is_stored(client, auth):
    report = run(client, auth, {**REPORT, "answered": True, "model": "claude-sonnet-5-5"})
    assert report["model"] == "claude-sonnet-5-5"
