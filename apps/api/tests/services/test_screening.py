"""Screening scorecard and risk checks: pure functions, hand-checked numbers."""

import pytest

from app.services.screening import (
    Criterion,
    DealMetrics,
    RiskInputs,
    Thresholds,
    derive_metrics,
    risk_checks,
    score_criterion,
    score_deal,
)

CRITERIA = [
    Criterion("scale", "Scale", 0.10, "ebitda", "band", 10, 60, "£10–60m"),
    Criterion("cash_conversion", "Cash conversion", 0.15, "cash_conversion", "linear", 0.60, 0.95, "≥ 85%"),
    Criterion("recurring", "Recurring revenue", 0.15, "recurring_pct", "linear", 0.40, 0.85, "≥ 70%"),
    Criterion("margin", "EBITDA margin", 0.15, "margin", "linear", 0.08, 0.25, "≥ 18%"),
    Criterion("growth", "Revenue growth", 0.10, "growth", "linear", 0.02, 0.22, "≥ 8%"),
    Criterion("moat", "Moat / AI resilience", 0.15, "ai_resilience", "linear", 0, 100, "≥ 65"),
    Criterion("buy_and_build", "Buy-and-build", 0.10, "fragmentation", "linear", 0, 100, "≥ 70"),
    Criterion(
        "entry_price", "Entry price", 0.10, "price_discount", "linear", -0.20, 0.20, "≤ segment median"
    ),
]
THRESHOLDS = Thresholds(advance=68, watch=55, gate_key="scale", gate_min=50)

NORTHVALE = DealMetrics(
    revenue=61.0,
    ebitda=14.6,
    growth=0.22,
    recurring_pct=0.71,
    capex_pct=0.03,
    ai_resilience=72,
    fragmentation=78,
    ask_multiple=15.5,
    segment_median_multiple=16.0,
)


def test_derived_metrics():
    m = derive_metrics(NORTHVALE)
    assert m["margin"] == pytest.approx(14.6 / 61.0)
    assert m["cash_conversion"] == pytest.approx((14.6 / 61.0 - 0.03) / (14.6 / 61.0))
    assert m["price_discount"] == pytest.approx(0.03125)
    assert m["ebitda"] == 14.6


@pytest.mark.parametrize(
    ("value", "expected"),
    [(0.60, 0.0), (0.95, 100.0), (0.775, 50.0), (0.10, 0.0), (1.20, 100.0)],
)
def test_linear_scoring_clamps(value, expected):
    c = Criterion("cc", "Cash conversion", 0.15, "cash_conversion", "linear", 0.60, 0.95, "")
    assert score_criterion(value, c) == pytest.approx(expected)


@pytest.mark.parametrize(
    ("value", "expected"),
    [(10, 100.0), (35, 100.0), (60, 100.0), (7.5, 50.0), (5, 0.0), (2, 0.0), (90, 50.0), (120, 0.0)],
)
def test_band_scoring(value, expected):
    # inside the band scores 100; falls to 0 at half the floor and at twice the ceiling
    c = CRITERIA[0]
    assert score_criterion(value, c) == pytest.approx(expected)


def test_northvale_scorecard():
    r = score_deal(NORTHVALE, CRITERIA, THRESHOLDS)
    by_key = {c.key: c for c in r.criteria}
    assert by_key["scale"].score == pytest.approx(100.0)
    assert by_key["cash_conversion"].score == pytest.approx(78.474, abs=1e-3)
    assert by_key["recurring"].score == pytest.approx(68.889, abs=1e-3)
    assert by_key["margin"].score == pytest.approx(93.732, abs=1e-3)
    assert by_key["growth"].score == pytest.approx(100.0)
    assert by_key["moat"].score == pytest.approx(72.0)
    assert by_key["buy_and_build"].score == pytest.approx(78.0)
    assert by_key["entry_price"].score == pytest.approx(57.8125)
    assert r.score == 81
    assert r.verdict == "Advance"
    assert [c.key for c in r.criteria] == [c.key for c in CRITERIA]
    assert by_key["margin"].value == pytest.approx(14.6 / 61.0)
    assert by_key["margin"].weight == 0.15
    assert by_key["margin"].target_text == "≥ 18%"


def test_verdict_bands():
    weak = NORTHVALE.model_copy(
        update={"growth": 0.02, "recurring_pct": 0.40, "ai_resilience": 30, "fragmentation": 40}
    )
    r = score_deal(weak, CRITERIA, THRESHOLDS)
    assert r.verdict in {"Watch", "Pass"}
    assert (r.verdict == "Watch") == (r.score >= 55)


def test_scale_gate_forces_pass_regardless_of_score():
    tiny = NORTHVALE.model_copy(update={"ebitda": 4.0, "revenue": 16.0})
    r = score_deal(tiny, CRITERIA, THRESHOLDS)
    assert r.verdict == "Pass"


def test_weights_must_sum_to_one():
    with pytest.raises(ValueError):
        score_deal(NORTHVALE, CRITERIA[:-1], THRESHOLDS)


def test_unknown_metric_is_an_error():
    bad = [*CRITERIA[:-1], Criterion("x", "X", 0.10, "no_such_metric", "linear", 0, 1, "")]
    with pytest.raises(KeyError):
        score_deal(NORTHVALE, bad, THRESHOLDS)


RISK_BENCHMARKS = {
    "customer_concentration": (0.05, 0.10),
    "gross_retention": (0.90, 0.93),
}


def risk(**kw):
    base = dict(
        top_customer_pct=0.04,
        gross_retention=0.95,
        cyclicality="Low",
        ask_multiple=14.0,
        segment_median_multiple=16.0,
        key_person_risk=False,
    )
    return RiskInputs(**{**base, **kw})


def statuses(inputs):
    return {c.key: c.status for c in risk_checks(inputs, RISK_BENCHMARKS)}


def test_all_clear():
    assert set(statuses(risk()).values()) == {"clear"}
    assert list(statuses(risk())) == ["concentration", "churn", "cyclicality", "valuation", "key_person"]


@pytest.mark.parametrize(
    ("kw", "key", "expected"),
    [
        ({"top_customer_pct": 0.05}, "concentration", "clear"),
        ({"top_customer_pct": 0.09}, "concentration", "watch"),
        ({"top_customer_pct": 0.14}, "concentration", "flag"),
        ({"gross_retention": 0.93}, "churn", "clear"),
        ({"gross_retention": 0.91}, "churn", "watch"),
        ({"gross_retention": 0.87}, "churn", "flag"),
        ({"cyclicality": "Medium"}, "cyclicality", "watch"),
        ({"cyclicality": "High"}, "cyclicality", "flag"),
        ({"ask_multiple": 16.0}, "valuation", "clear"),
        ({"ask_multiple": 17.5}, "valuation", "watch"),
        ({"ask_multiple": 18.0}, "valuation", "flag"),
        ({"key_person_risk": True}, "key_person", "flag"),
    ],
)
def test_risk_bands(kw, key, expected):
    assert statuses(risk(**kw))[key] == expected


def test_risk_checks_explain_themselves():
    checks = risk_checks(risk(top_customer_pct=0.09), RISK_BENCHMARKS)
    concentration = next(c for c in checks if c.key == "concentration")
    assert "9%" in concentration.detail
    assert concentration.label == "Customer concentration"
