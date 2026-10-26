"""7.6: research findings keep the agent's confidence label as given (TODO.md)."""

from tests.test_jobs import REPORT, start


def test_finding_confidence_is_stored_as_the_label(client, auth):
    job = start(client)
    assert (
        client.post(f"/internal/jobs/{job['id']}/result", headers=auth, json={"payload": REPORT}).status_code
        == 204
    )
    report_id = client.get(f"/api/jobs/{job['id']}").json()["result_ref"]
    findings = client.get("/api/research-findings", params={"report_id": report_id}).json()["items"]
    assert sorted(f["confidence"] for f in findings) == ["low", "medium"]


def test_research_reports_can_have_no_verified_findings(client, auth):
    job = start(client)
    empty = {**REPORT, "findings": [], "sources": []}
    assert (
        client.post(f"/internal/jobs/{job['id']}/result", headers=auth, json={"payload": empty}).status_code
        == 204
    )
    assert client.get(f"/api/jobs/{job['id']}").json()["status"] == "succeeded"


def test_unknown_confidence_label_is_rejected(client, auth):
    job = start(client)
    bad = {**REPORT, "findings": [{**REPORT["findings"][0], "confidence": "certain"}]}
    assert (
        client.post(f"/internal/jobs/{job['id']}/result", headers=auth, json={"payload": bad}).status_code
        == 422
    )
