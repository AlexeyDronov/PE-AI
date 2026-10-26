"""The OpenAPI document is the contract the web app and agent generate their types from,
so every route must publish a named, typed schema (rule R1: types come from the backend)."""

import pytest

from app.commands import COMMANDS
from app.compute import COMPUTES
from app.resources import RESOURCES


@pytest.fixture
def spec(client):
    return client.get("/openapi.json").json()


def ok_schema(spec, path, method="get", status="200"):
    return spec["paths"][path][method]["responses"][status]["content"]["application/json"]["schema"]


def ref_name(schema):
    return schema["$ref"].rsplit("/", 1)[-1]


def page_item(spec, schema):
    page = spec["components"]["schemas"][ref_name(schema)]
    return ref_name(page["properties"]["items"]["items"])


def props(spec, name):
    return set(spec["components"]["schemas"][name]["properties"])


@pytest.mark.parametrize("res", [r for r in RESOURCES if not r.detail_only], ids=lambda r: r.name)
def test_every_list_route_returns_a_named_page(spec, res):
    schema = ok_schema(spec, f"/api/{res.name}")
    assert "$ref" in schema
    assert page_item(spec, schema)


def test_deal_list_and_detail_are_typed(spec):
    item = page_item(spec, ok_schema(spec, "/api/deals"))
    assert item == "DealListItem"
    assert {"id", "company", "segment", "financials", "screening", "stage", "ask_multiple"} <= props(
        spec, item
    )
    detail = ref_name(ok_schema(spec, "/api/deals/{id}"))
    assert detail == "DealDetail"
    assert {"risks", "flags", "questions", "debt_capacity"} <= props(spec, detail)
    verdict = spec["components"]["schemas"]["ScreeningSummary"]["properties"]["verdict"]
    assert set(verdict["enum"]) == {"Advance", "Watch", "Pass"}


def test_enriched_portfolio_and_fund_are_typed(spec):
    assert page_item(spec, ok_schema(spec, "/api/portfolio-companies")) == "PortfolioCompanyListItem"
    assert {"moic", "budget_variance", "facility", "company"} <= props(spec, "PortfolioCompanyListItem")
    assert page_item(spec, ok_schema(spec, "/api/funds")) == "FundWithMetrics"
    assert "metrics" in props(spec, "FundWithMetrics")


@pytest.mark.parametrize("c", COMPUTES, ids=lambda c: c.name)
def test_every_compute_has_its_own_typed_route(spec, c):
    op = spec["paths"][f"/api/compute/{c.name}"]["post"]
    assert "$ref" in op["requestBody"]["content"]["application/json"]["schema"]
    assert "$ref" in ok_schema(spec, f"/api/compute/{c.name}", "post")


def test_lbo_contract_names(spec):
    op = spec["paths"]["/api/compute/lbo"]["post"]
    assert ref_name(op["requestBody"]["content"]["application/json"]["schema"]) == "LboRequest"
    assert ref_name(ok_schema(spec, "/api/compute/lbo", "post")) == "LboResponse"


@pytest.mark.parametrize("c", COMMANDS, ids=lambda c: c.name)
def test_every_command_has_its_own_typed_route(spec, c):
    op = spec["paths"][f"/api/commands/{c.name}"]["post"]
    assert "$ref" in op["requestBody"]["content"]["application/json"]["schema"]
    status = str(c.status_code)
    assert "$ref" in op["responses"][status]["content"]["application/json"]["schema"]


def test_command_schema_names(spec):
    op = spec["paths"]["/api/commands/save-scenario"]["post"]
    assert ref_name(op["requestBody"]["content"]["application/json"]["schema"]) == "SaveScenarioInput"
    assert ref_name(op["responses"]["201"]["content"]["application/json"]["schema"]) == "LboScenarioRead"


def test_unknown_names_still_get_the_error_shape(client):
    assert client.post("/api/commands/nope", json={}).json()["error"]["code"] == "unknown_command"
    assert client.post("/api/compute/nope", json={}).json()["error"]["code"] == "unknown_compute"


# ---------- pipeline summary (aggregates belong in the backend) ----------


def test_pipeline_summary(client):
    s = client.get("/api/pipeline-summary").json()
    deals = client.get("/api/deals").json()["items"]
    assert s["total"] == len(deals)
    for verdict in ("Advance", "Watch", "Pass"):
        assert s["counts"][verdict] == sum(d["screening"]["verdict"] == verdict for d in deals)
    scores = [d["screening"]["score"] for d in deals]
    assert s["average_score"] == pytest.approx(sum(scores) / len(scores))
    asks = sorted(d["ask_multiple"] for d in deals)
    mid = len(asks) // 2
    median = asks[mid] if len(asks) % 2 else (asks[mid - 1] + asks[mid]) / 2
    assert s["median_ask"] == pytest.approx(median)
    assert [b["stage"] for b in s["by_stage"]] == ["Teaser", "NDA", "CIM", "IOI", "LOI", "Exclusivity", "SPA"]
    assert sum(b["count"] for b in s["by_stage"]) == len(deals)
    seg = s["by_segment"][0]
    assert {"segment_id", "short", "count", "average_score", "best_score"} <= set(seg)
    assert all(b["best_score"] >= b["average_score"] for b in s["by_segment"])


def test_pipeline_summary_is_typed(spec):
    assert ref_name(ok_schema(spec, "/api/pipeline-summary")) == "PipelineSummary"
