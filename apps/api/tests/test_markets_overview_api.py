"""Backend for 6.9 Markets, 6.10 Segment and 6.11 Overview (plan 2.10 market part)."""

import statistics

import pytest


def segments(client):
    return client.get("/api/segments").json()["items"]


# ---------- 6.9 markets ----------


def test_segments_carry_attribute_scores_and_attractiveness(client):
    items = segments(client)
    s = items[0]
    assert [a["attribute"] for a in s["attributes"]] == [
        "Non-cyclical",
        "Contracted / recurring",
        "Technical moat",
        "Synergy potential",
        "Industry tailwinds",
        "Fragmented / local",
    ]
    for seg in items:
        assert seg["attractiveness"] == sum(a["score"] for a in seg["attributes"])
        assert seg["attractiveness_max"] == 18


def test_segments_sort_by_attractiveness(client):
    items = client.get("/api/segments", params={"sort": "-attractiveness"}).json()["items"]
    scores = [s["attractiveness"] for s in items]
    assert scores == sorted(scores, reverse=True)


def test_market_summary(client):
    m = client.get("/api/market-summary").json()
    items = segments(client)
    assert m["segments"] == 7
    assert m["profit_pool"] == pytest.approx(sum(s["market_size"] for s in items))
    assert m["median_multiple"] == pytest.approx(statistics.median(s["median_multiple"] for s in items))
    assert m["deals_24m"] == sum(s["deal_count_24m"] for s in items)
    assert m["reports"] == 0


# ---------- 6.10 segment ----------


def test_segment_detail(client):
    comp = next(s for s in segments(client) if s["short"] == "Compliance")
    d = client.get(f"/api/segments/{comp['id']}").json()
    assert d["name"] == comp["name"]
    assert d["attributes"] and d["exit_route_mix"]["strategic_pct"] >= 0
    tx = d["transactions"]
    assert tx and [t["date"] for t in tx] == sorted((t["date"] for t in tx), reverse=True)
    assert all(t["segment_id"] == comp["id"] for t in tx)
    names = {p["name"]: p["kind"] for p in d["players"]}
    assert names["Lumen Risk"] == "portfolio"
    assert names["Northvale Compliance"] == "pipeline"
    deals = d["matching_deals"]
    assert {x["company"]["name"] for x in deals} >= {"Northvale Compliance", "Brightwater Assurance"}
    assert all("verdict" in x["screening"] for x in deals)
    assert d["reports"] == []


def test_segment_detail_404(client):
    assert client.get("/api/segments/nope").status_code == 404


# ---------- 6.11 overview ----------


def test_overview_summary(client):
    o = client.get("/api/overview-summary").json()
    fund = client.get("/api/funds").json()["items"][0]
    m = fund["metrics"]
    assert o["nav"] == pytest.approx(m["nav"])
    assert o["net_irr"] == pytest.approx(m["net_irr"])
    assert o["tvpi"] == pytest.approx(m["tvpi"])
    assert o["dpi"] == pytest.approx(m["dpi"])
    assert o["dry_powder"] == pytest.approx(fund["committed"] - m["called"])
    deals = client.get("/api/deals").json()["items"]
    assert o["in_diligence"] == sum(d["stage"] in {"CIM", "IOI", "LOI", "Exclusivity", "SPA"} for d in deals)
    assert o["pipeline_total"] == len(deals)
    alerts = client.get("/api/alerts").json()["items"]
    assert o["alerts"] == {sev: sum(a["severity"] == sev for a in alerts) for sev in ("bad", "warn", "acc")}


def test_awaiting_decision_lists_advance_deals_best_first(client):
    items = client.get("/api/deals", params={"verdict": "Advance", "sort": "-score"}).json()["items"]
    assert items and items[0]["screening"]["score"] >= items[-1]["screening"]["score"]
