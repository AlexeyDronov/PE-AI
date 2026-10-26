"""Services exposed through the API: enriched reads and cached compute endpoints."""

import pytest


def deal_id(client, name="Northvale Compliance"):
    deals = client.get("/api/deals").json()["items"]
    return next(d["id"] for d in deals if d["company"]["name"] == name)


# ---------- deals enrichment ----------


def test_deal_list_is_enriched_for_the_pipeline_table(client):
    items = client.get("/api/deals").json()["items"]
    d = next(i for i in items if i["company"]["name"] == "Northvale Compliance")
    assert d["company"]["hq"]
    assert d["segment"]["short"] == "Compliance"
    assert d["financials"]["ebitda"] == 14.6
    assert d["screening"]["verdict"] in {"Advance", "Watch", "Pass"}
    assert 0 <= d["screening"]["score"] <= 100
    assert "criteria" not in d["screening"]  # detail only


def test_deal_list_can_filter_by_computed_verdict_and_sort_by_score(client):
    advance = client.get("/api/deals", params={"verdict": "Advance"}).json()
    assert advance["total"] >= 1
    assert all(d["screening"]["verdict"] == "Advance" for d in advance["items"])
    scores = [
        d["screening"]["score"] for d in client.get("/api/deals", params={"sort": "-score"}).json()["items"]
    ]
    assert scores == sorted(scores, reverse=True)


def test_deal_detail_has_scorecard_risks_flags_questions_and_debt_capacity(client):
    d = client.get(f"/api/deals/{deal_id(client)}").json()
    criteria = d["screening"]["criteria"]
    assert len(criteria) == 8
    assert {"key", "label", "value", "score", "weight", "target_text"} <= set(criteria[0])
    assert [r["key"] for r in d["risks"]] == [
        "concentration",
        "churn",
        "cyclicality",
        "valuation",
        "key_person",
    ]
    assert d["flags"] and {"severity", "text", "mitigant"} <= set(d["flags"][0])
    assert d["questions"]
    dc = d["debt_capacity"]
    assert dc["senior_debt"] == pytest.approx(3.0 * 14.6)
    assert dc["interest_cover"] > 0


def test_scores_use_criteria_from_the_database(client):
    d = client.get(f"/api/deals/{deal_id(client)}").json()
    weights = {c["key"]: c["weight"] for c in d["screening"]["criteria"]}
    db = {c["key"]: c["weight"] for c in client.get("/api/screening-criteria").json()["items"]}
    assert weights == db


# ---------- portfolio and fund enrichment ----------


def test_portfolio_companies_are_enriched(client):
    items = client.get("/api/portfolio-companies").json()["items"]
    orbis = next(p for p in items if p["company"]["name"] == "Orbis Language Tech")
    assert orbis["moic"] == pytest.approx(58 / 71)
    assert orbis["budget_variance"] == pytest.approx(9.2 / 12.6 - 1)
    assert orbis["segment"]["short"] == "Legal ops"
    assert orbis["facility"]["headroom"] == pytest.approx(
        1 - orbis["facility"]["actual"] / orbis["facility"]["test_level"]
    )


def test_fund_has_metrics(client):
    fund = client.get("/api/funds").json()["items"][0]
    m = fund["metrics"]
    assert m["tvpi"] == pytest.approx((m["distributed"] + m["nav"]) / m["called"])
    assert m["dpi"] == pytest.approx(m["distributed"] / m["called"])
    assert -0.5 < m["net_irr"] < 0.6
    assert len(m["series"]) >= 10


def test_alerts_carry_the_company_name(client):
    a = client.get("/api/alerts").json()["items"][0]
    assert a["company"]["name"]


# ---------- compute ----------


def lbo(client, **body):
    return client.post("/api/compute/lbo", json={"deal_id": deal_id(client), **body})


def test_lbo_base_case(client):
    r = lbo(client)
    assert r.status_code == 200, r.text
    body = r.json()
    su = body["sources_uses"]
    assert su["total_sources"] == pytest.approx(su["total_uses"])
    assert su["enterprise_value"] == pytest.approx(15.5 * 14.6)
    assert len(body["schedule"]) == 5
    assert body["assumptions"]["entry_multiple"] == 15.5
    assert body["case"] == "base"
    assert body["hurdle"] == 0.2
    assert {"irr", "moic"} <= set(body["returns"])
    assert body["bridge"][0]["label"] == "Entry equity"


def test_cases_order_returns(client):
    irr = {c: lbo(client, case=c).json()["returns"]["irr"] for c in ("down", "base", "up")}
    assert irr["down"] < irr["base"] < irr["up"]


def test_overrides_flow_through(client):
    base = lbo(client).json()["returns"]["irr"]
    dearer = lbo(client, overrides={"entry_multiple": 17.0}).json()
    assert dearer["assumptions"]["entry_multiple"] == 17.0
    assert dearer["returns"]["irr"] < base
    faster = lbo(client, overrides={"growth_y1": 0.30}).json()
    assert faster["assumptions"]["revenue_growth"][0] == pytest.approx(0.30)
    assert faster["returns"]["irr"] > base


def test_max_bid_clears_the_hurdle_exactly(client):
    body = lbo(client).json()
    m = body["max_bid"]["multiple"]
    assert body["max_bid"]["enterprise_value"] == pytest.approx(m * 14.6)
    at_max = lbo(client, overrides={"entry_multiple": m}).json()
    assert at_max["returns"]["irr"] == pytest.approx(0.20, abs=1e-3)


def test_invalid_structures_are_422(client):
    r = lbo(client, overrides={"total_leverage": 3.0, "senior_leverage": 3.5})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "invalid_assumptions"


def test_unknown_deal_is_404(client):
    r = client.post("/api/compute/lbo", json={"deal_id": "nope"})
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "not_found"


def test_sensitivity_grid_is_centred_on_the_case(client):
    r = client.post("/api/compute/lbo-sensitivity", json={"deal_id": deal_id(client)})
    assert r.status_code == 200, r.text
    g = r.json()
    assert len(g["entry"]) == len(g["exit"]) == 5
    assert g["entry"][2] == 15.5 and g["exit"][2] == 15.5
    assert g["irr"][2][2] == pytest.approx(lbo(client).json()["returns"]["irr"])


def test_debt_capacity_endpoint(client):
    r = client.post("/api/compute/debt-capacity", json={"deal_id": deal_id(client)})
    assert r.status_code == 200
    assert r.json()["senior_debt"] == pytest.approx(43.8)


# ---------- caching (D4) ----------


def test_identical_compute_requests_are_served_from_cache(client):
    first = lbo(client, overrides={"entry_multiple": 16.0})
    second = lbo(client, overrides={"entry_multiple": 16.0})
    assert first.headers["x-cache"] == "miss"
    assert second.headers["x-cache"] == "hit"
    assert first.json() == second.json()
    assert lbo(client, overrides={"entry_multiple": 16.5}).headers["x-cache"] == "miss"


def test_key_order_does_not_defeat_the_cache(client):
    did = deal_id(client)
    a = client.post(
        "/api/compute/lbo",
        json={"deal_id": did, "case": "up", "overrides": {"exit_multiple": 14, "entry_multiple": 15}},
    )
    b = client.post(
        "/api/compute/lbo",
        json={"overrides": {"entry_multiple": 15, "exit_multiple": 14}, "case": "up", "deal_id": did},
    )
    assert (a.headers["x-cache"], b.headers["x-cache"]) == ("miss", "hit")


def test_writes_invalidate_the_cache(client):
    lbo(client)
    assert lbo(client).headers["x-cache"] == "hit"
    client.post(
        "/api/commands/save-scenario",
        json={"deal_id": deal_id(client), "name": "n", "case": "base", "overrides": {}},
    )
    assert lbo(client).headers["x-cache"] == "miss"


# ---------- browser review of the Pipeline page (step 6.1) ----------


def test_gated_deals_explain_why_they_pass(client):
    items = client.get("/api/deals").json()["items"]
    small = next(d for d in items if d["company"]["name"] == "Brightwater Assurance")
    assert small["screening"]["verdict"] == "Pass"
    reason = small["screening"]["gate_reason"]
    assert "£7.1m" in reason and "£10m" in reason and "below" in reason
    big = next(d for d in items if d["company"]["name"] == "Northvale Compliance")
    assert big["screening"]["gate_reason"] is None
