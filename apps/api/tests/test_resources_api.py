"""Every read endpoint is generated from the resource registry."""

import pytest

from app.resources import RESOURCES

LIST_RESOURCES = [r.name for r in RESOURCES if not r.detail_only]


def test_registry_contains_core_resources():
    names = {r.name for r in RESOURCES}
    assert {
        "segments",
        "deals",
        "companies",
        "portfolio-companies",
        "kpi-points",
        "alerts",
        "funds",
        "fund-cashflows",
        "transactions",
        "benchmarks",
        "screening-criteria",
        "debt-facilities",
        "value-creation-items",
        "exit-plans",
        "research-reports",
        "jobs",
        "annotations",
    } <= names


@pytest.mark.parametrize("name", LIST_RESOURCES)
def test_every_list_resource_responds(client, name):
    r = client.get(f"/api/{name}")
    assert r.status_code == 200, r.text
    body = r.json()
    assert set(body) == {"items", "total"}
    assert isinstance(body["items"], list)


def test_segments_list(client):
    body = client.get("/api/segments").json()
    assert body["total"] == 7
    expected = {"id", "name", "short", "market_size", "cagr", "avg_margin", "median_multiple"}
    assert expected <= set(body["items"][0])


def test_filter_and_sort_via_query(client):
    body = client.get("/api/deals", params={"stage": "CIM"}).json()
    assert body["total"] >= 1
    assert all(d["stage"] == "CIM" for d in body["items"])
    cagr = [s["cagr"] for s in client.get("/api/segments", params={"sort": "-cagr"}).json()["items"]]
    assert cagr == sorted(cagr, reverse=True)


def test_pagination_via_query(client):
    body = client.get("/api/kpi-points", params={"limit": 3, "offset": 0}).json()
    assert len(body["items"]) == 3
    assert body["total"] > 3


def test_unknown_filter_is_400_with_error_shape(client):
    r = client.get("/api/deals", params={"colour": "blue"})
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "invalid_filter"


def test_detail_and_404(client):
    item = client.get("/api/segments").json()["items"][0]
    r = client.get(f"/api/segments/{item['id']}")
    assert r.status_code == 200
    assert r.json()["name"] == item["name"]
    missing = client.get("/api/segments/does-not-exist")
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "not_found"


@pytest.mark.parametrize("method", ["post", "put", "patch", "delete"])
def test_read_routes_reject_writes(client, method):
    assert getattr(client, method)("/api/deals").status_code == 405
    item = client.get("/api/deals").json()["items"][0]
    assert getattr(client, method)(f"/api/deals/{item['id']}").status_code == 405


def test_kpi_points_filter_by_company_and_metric(client):
    pc = client.get("/api/portfolio-companies").json()["items"][0]
    body = client.get("/api/kpi-points", params={"company_id": pc["company_id"], "metric": "ebitda"}).json()
    assert body["total"] == 8
    assert all(p["metric"] == "ebitda" for p in body["items"])


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}
