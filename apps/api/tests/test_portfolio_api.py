"""Backend aggregates for the portfolio pages (plan 2.10 portfolio part; steps 6.4–6.6)."""

import pytest


def platforms(client):
    return client.get("/api/portfolio-companies").json()["items"]


def by_name(client, name):
    return next(p for p in platforms(client) if p["company"]["name"] == name)


# ---------- 6.4 portfolio summary ----------


def test_portfolio_summary_totals(client):
    s = client.get("/api/portfolio-summary").json()
    ps = platforms(client)
    assert s["platforms"] == len(ps) == 6
    assert s["invested"] == pytest.approx(sum(p["invested"] for p in ps))
    assert s["fair_value"] == pytest.approx(sum(p["fair_value"] for p in ps))
    assert s["moic"] == pytest.approx(s["fair_value"] / s["invested"])
    assert s["status_counts"] == {
        "good": sum(p["status"] == "good" for p in ps),
        "warn": sum(p["status"] == "warn" for p in ps),
        "bad": sum(p["status"] == "bad" for p in ps),
        "acc": sum(p["status"] == "acc" for p in ps),
    }


def test_portfolio_value_bridge_reconciles(client):
    s = client.get("/api/portfolio-summary").json()
    bridge = s["value_bridge"]
    assert bridge[0]["label"] == "Invested" and bridge[0]["value"] == pytest.approx(s["invested"])
    assert bridge[-1]["label"] == "Fair value" and bridge[-1]["value"] == pytest.approx(s["fair_value"])
    middle = sum(b["value"] for b in bridge[1:-1])
    assert bridge[0]["value"] + middle == pytest.approx(bridge[-1]["value"])
    levers = {b["label"] for b in bridge[1:-1]}
    assert "Revenue growth" in levers


def test_status_labels_are_part_of_the_contract(client):
    p = platforms(client)[0]
    assert p["status_label"] in {"On plan", "Watch", "Action", "Exit prep"}


# ---------- 6.5 platform detail ----------


def test_platform_detail_bundles_everything_the_page_needs(client):
    orbis = by_name(client, "Orbis Language Tech")
    d = client.get(f"/api/portfolio-companies/{orbis['id']}").json()
    assert d["company"]["name"] == "Orbis Language Tech"
    q = d["quarters"]
    assert [x["period"] for x in q] == sorted(x["period"] for x in q)
    assert len(q) == 8 and {"period", "ebitda", "ebitda_budget"} <= set(q[0])
    assert q[-1]["ebitda"] == pytest.approx(orbis["ebitda_ltm"])
    assert d["facility"]["headroom"] == pytest.approx(1 - 5.6 / 6.0, abs=1e-6)
    assert d["value_creation"] and {"lever", "amount"} <= set(d["value_creation"][0])
    assert d["alerts"] and all(a["company_id"] == orbis["company_id"] for a in d["alerts"])
    assert {"route", "buyers", "window"} <= set(d["exit_plan"])


def test_platform_detail_404(client):
    r = client.get("/api/portfolio-companies/nope")
    assert r.status_code == 404


# ---------- 6.6 covenants ----------


def test_facilities_carry_headroom_band_and_next_test(client):
    items = client.get("/api/debt-facilities").json()["items"]
    assert len(items) == 6
    for f in items:
        assert f["headroom"] == pytest.approx(1 - f["actual"] / f["test_level"], abs=1e-6)
        expected = "breach" if f["headroom"] < 0 else "tight" if f["headroom"] < 0.15 else "comfortable"
        assert f["band"] == expected
        assert f["next_test_date"] >= "2026-10-25"
    assert any(f["band"] == "tight" for f in items)


def test_covenant_summary(client):
    s = client.get("/api/covenant-summary").json()
    items = client.get("/api/debt-facilities").json()["items"]
    assert s["facilities"] == len(items)
    assert s["tightest"]["company"] == min(items, key=lambda f: f["headroom"])["company"]["name"]
    assert s["tightest"]["headroom"] == pytest.approx(min(f["headroom"] for f in items))
    assert s["below_comfort"] == sum(f["headroom"] < 0.15 for f in items)
    assert s["comfort_threshold"] == pytest.approx(0.15)
    assert s["next_test_date"] == min(f["next_test_date"] for f in items)


def test_comfort_threshold_comes_from_benchmarks(client):
    keys = {b["key"]: b for b in client.get("/api/benchmarks").json()["items"]}
    assert keys["covenant_headroom_comfort"]["low"] == pytest.approx(0.15)
