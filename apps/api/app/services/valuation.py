"""Valuation range (football field): trading comps, precedent transactions and LBO capacity."""

from pydantic import BaseModel

from app.services import lbo

COMPS_SPREAD = 1.0
LBO_HIGH_IRR = 0.25


class ValuationRow(BaseModel):
    label: str
    low: float
    high: float


class ValuationRange(BaseModel):
    ask: float
    rows: list[ValuationRow]


def percentile(sorted_values: list[float], q: float) -> float:
    """Linear-interpolated percentile of an ascending list."""
    pos = q * (len(sorted_values) - 1)
    lo = int(pos)
    hi = min(lo + 1, len(sorted_values) - 1)
    return sorted_values[lo] + (sorted_values[hi] - sorted_values[lo]) * (pos - lo)


def valuation_range(
    a: lbo.LboAssumptions,
    ask_multiple: float,
    median_multiple: float,
    precedent_multiples: list[float],
    fund_hurdle: float,
) -> ValuationRange:
    """Enterprise value ranges (£m) by method, plus the ask."""
    ebitda = a.ebitda0
    multiples = sorted(precedent_multiples) or [median_multiple]
    if len(multiples) >= 2:
        p_low, p_high = percentile(multiples, 0.25), percentile(multiples, 0.75)
    else:
        p_low, p_high = multiples[0], multiples[-1]
    lbo_low = lbo.max_entry_multiple(a, LBO_HIGH_IRR)
    lbo_high = lbo.max_entry_multiple(a, fund_hurdle)
    return ValuationRange(
        ask=ask_multiple * ebitda,
        rows=[
            ValuationRow(
                label="Trading comps",
                low=(median_multiple - COMPS_SPREAD) * ebitda,
                high=(median_multiple + COMPS_SPREAD) * ebitda,
            ),
            ValuationRow(label="Precedent transactions", low=p_low * ebitda, high=p_high * ebitda),
            ValuationRow(label="LBO at 20–25% IRR", low=lbo_low * ebitda, high=lbo_high * ebitda),
        ],
    )
