"""Screening scorecard and risk checks."""

from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel


@dataclass(frozen=True)
class Criterion:
    key: str
    label: str
    weight: float
    metric: str
    kind: Literal["linear", "band"]
    floor: float
    ceiling: float
    target_text: str


class DealMetrics(BaseModel):
    revenue: float
    ebitda: float
    growth: float
    recurring_pct: float
    capex_pct: float
    ai_resilience: float
    fragmentation: float
    ask_multiple: float
    segment_median_multiple: float


@dataclass(frozen=True)
class Thresholds:
    advance: float
    watch: float
    gate_key: str
    gate_min: float


class RiskInputs(BaseModel):
    top_customer_pct: float
    gross_retention: float
    cyclicality: Literal["Low", "Medium", "High"]
    ask_multiple: float
    segment_median_multiple: float
    key_person_risk: bool


class CriterionScore(BaseModel):
    key: str
    label: str
    value: float
    score: float
    weight: float
    target_text: str


class ScreeningResult(BaseModel):
    score: int
    verdict: Literal["Advance", "Watch", "Pass"]
    criteria: list[CriterionScore]
    gate_reason: str | None = None


class RiskCheck(BaseModel):
    key: str
    label: str
    status: Literal["clear", "watch", "flag"]
    detail: str


def derive_metrics(m: DealMetrics) -> dict[str, float]:
    """Turn raw deal facts into the metrics the scorecard criteria refer to."""
    margin = m.ebitda / m.revenue
    return {
        "ebitda": m.ebitda,
        "margin": margin,
        "cash_conversion": (margin - m.capex_pct) / margin,
        "growth": m.growth,
        "recurring_pct": m.recurring_pct,
        "ai_resilience": m.ai_resilience,
        "fragmentation": m.fragmentation,
        "price_discount": (m.segment_median_multiple - m.ask_multiple) / m.segment_median_multiple,
    }


def _clamp(x: float) -> float:
    return max(0.0, min(100.0, x))


def score_criterion(value: float, c: Criterion) -> float:
    """Score a metric 0-100, linearly or against a target band."""
    if c.kind == "linear":
        return _clamp((value - c.floor) / (c.ceiling - c.floor) * 100)
    if value < c.floor:
        return _clamp((value - c.floor / 2) / (c.floor / 2) * 100)
    if value > c.ceiling:
        return _clamp((2 * c.ceiling - value) / c.ceiling * 100)
    return 100.0


def score_deal(metrics: DealMetrics, criteria: list[Criterion], thresholds: Thresholds) -> ScreeningResult:
    """Weighted scorecard with a verdict and a minimum-score gate."""
    if abs(sum(c.weight for c in criteria) - 1.0) > 1e-6:
        raise ValueError("criterion weights must sum to 1")
    derived = derive_metrics(metrics)
    scored = [
        CriterionScore(
            key=c.key,
            label=c.label,
            value=derived[c.metric],
            score=score_criterion(derived[c.metric], c),
            weight=c.weight,
            target_text=c.target_text,
        )
        for c in criteria
    ]
    score = round(sum(s.weight * s.score for s in scored))
    gate = next(s for s in scored if s.key == thresholds.gate_key)
    gate_failed = gate.score < thresholds.gate_min
    if gate_failed or score < thresholds.watch:
        verdict = "Pass"
    else:
        verdict = "Advance" if score >= thresholds.advance else "Watch"
    reason = _gate_reason(gate, next(c for c in criteria if c.key == gate.key)) if gate_failed else None
    return ScreeningResult(score=score, verdict=verdict, criteria=scored, gate_reason=reason)


def _gate_reason(gate: CriterionScore, c: Criterion) -> str:
    """Plain-English explanation of why the mandate gate forced a Pass."""
    if gate.value < c.floor:
        return f"EBITDA £{gate.value:g}m is below the £{c.floor:g}m mandate floor"
    return f"EBITDA £{gate.value:g}m is above the £{c.ceiling:g}m mandate ceiling"


def _band(value: float, low: float, high: float) -> Literal["clear", "watch", "flag"]:
    return "clear" if value <= low else "watch" if value <= high else "flag"


def risk_checks(inputs: RiskInputs, benchmarks: dict[str, tuple[float, float]]) -> list[RiskCheck]:
    """Traffic-light the main diligence risks against benchmark bands."""
    conc_low, conc_high = benchmarks["customer_concentration"]
    ret_low, ret_high = benchmarks["gross_retention"]
    retention = inputs.gross_retention
    churn = "clear" if retention >= ret_high else "watch" if retention >= ret_low else "flag"
    cyc = {"Low": "clear", "Medium": "watch", "High": "flag"}[inputs.cyclicality]
    ask, median = inputs.ask_multiple, inputs.segment_median_multiple
    valuation = "clear" if ask <= median else "watch" if ask <= 1.1 * median else "flag"
    return [
        RiskCheck(
            key="concentration",
            label="Customer concentration",
            status=_band(inputs.top_customer_pct, conc_low, conc_high),
            detail=f"Largest customer is {inputs.top_customer_pct:.0%} of revenue.",
        ),
        RiskCheck(
            key="churn",
            label="Churn",
            status=churn,
            detail=f"Gross retention is {retention:.0%}.",
        ),
        RiskCheck(
            key="cyclicality",
            label="Cyclicality",
            status=cyc,
            detail=f"{inputs.cyclicality} sensitivity to the economic cycle.",
        ),
        RiskCheck(
            key="valuation",
            label="Entry valuation",
            status=valuation,
            detail=f"Asking {ask:.1f}x against a segment median of {median:.1f}x.",
        ),
        RiskCheck(
            key="key_person",
            label="Key person",
            status="flag" if inputs.key_person_risk else "clear",
            detail="The business depends on a key individual."
            if inputs.key_person_risk
            else "No single-person dependency identified.",
        ),
    ]
