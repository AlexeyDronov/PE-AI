"""Backend for steps 6.7 Exits and 6.8 Fund performance."""

import pytest


def fund(client):
    return client.get("/api/funds").json()["items"][0]


# ---------- 6.8 fund performance ----------


def test_fund_terms_are_data(client):
    f = fund(client)
    assert f["pref_rate"] == pytest.approx(0.08)
    assert f["carry"] == pytest.approx(0.20)
    assert f["catch_up"] == pytest.approx(1.0)


def test_fund_metrics_include_the_waterfall_on_hypothetical_liquidation(client):
    m = fund(client)["metrics"]
    tiers = m["waterfall"]
    assert [t["label"] for t in tiers] == [
        "Return of capital",
        "Preferred return",
        "GP catch-up",
        "Carried interest split",
    ]
    total = sum(t["lp"] + t["gp"] for t in tiers)
    assert total == pytest.approx(m["distributed"] + m["nav"])
    assert m["gross_profit"] == pytest.approx(m["distributed"] + m["nav"] - m["called"])
    assert m["lp_total"] == pytest.approx(sum(t["lp"] for t in tiers))
    assert m["gp_carry"] == pytest.approx(sum(t["gp"] for t in tiers))


def test_fund_cashflows_table_is_ordered(client):
    rows = client.get("/api/fund-cashflows", params={"sort": "period"}).json()["items"]
    assert [r["period"] for r in rows] == sorted(r["period"] for r in rows)
    assert {"calls", "distributions", "nav"} <= set(rows[0])


# ---------- 6.7 exits ----------


def test_exit_plans_carry_platform_figures(client):
    plans = client.get("/api/exit-plans").json()["items"]
    assert len(plans) == 6
    p = plans[0]
    assert {"id", "moic", "fair_value", "status", "status_label"} <= set(p["platform"])
    lumen = next(x for x in plans if x["company"]["name"] == "Lumen Risk")
    assert lumen["platform"]["status_label"] == "Exit prep"


def test_exit_summary(client):
    s = client.get("/api/exit-summary").json()
    plans = client.get("/api/exit-plans").json()["items"]
    prep = [p for p in plans if p["platform"]["status"] == "acc"]
    assert s["platforms"] == len(plans)
    assert s["exit_prep"] == len(prep)
    assert s["exit_prep_fair_value"] == pytest.approx(sum(p["platform"]["fair_value"] for p in prep))
    assert sum(s["routes"].values()) == len(plans)


def test_exit_route_mix_by_segment(client):
    items = client.get("/api/exit-route-mixes").json()["items"]
    assert len(items) == 7
    for row in items:
        assert row["segment"]["short"]
        assert row["strategic_pct"] + row["sponsor_pct"] + row["ipo_pct"] == pytest.approx(100)


# ---------- found reviewing live numbers: projections were counted as actuals ----------


def test_fund_metrics_are_as_of_the_valuation_date(client):
    f = fund(client)
    m = f["metrics"]
    assert f["as_of"] == "2026-09-30"
    assert m["as_of_period"] == "2026"
    assert m["called"] < f["committed"]
    assert m["nav"] > m["distributed"] * 0.1
    actual = [p for p in m["series"] if not p["projected"]]
    assert actual and actual[-1]["period"] == "2026"
    assert all(p["projected"] for p in m["series"] if p["period"] > "2026")
    assert m["called"] == pytest.approx(sum(p["calls"] for p in actual))
    assert m["nav"] == pytest.approx(actual[-1]["nav"])
