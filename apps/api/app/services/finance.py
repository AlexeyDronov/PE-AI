"""IRR and fund performance maths."""

from collections.abc import Sequence

from pydantic import BaseModel


def _npv(rate: float, cashflows: Sequence[float]) -> float:
    return sum(cf / (1 + rate) ** t for t, cf in enumerate(cashflows))


def irr(cashflows: Sequence[float]) -> float:
    """Annual IRR by bracketing and bisection; raises ValueError without a sign change."""
    if not (any(c > 0 for c in cashflows) and any(c < 0 for c in cashflows)):
        raise ValueError("cash flows need at least one positive and one negative value")
    lo, hi = -0.999999, 1.0
    while _npv(lo, cashflows) * _npv(hi, cashflows) > 0:
        hi *= 2
        if hi > 1e9:
            raise ValueError("no IRR found")
    for _ in range(300):
        mid = (lo + hi) / 2
        if _npv(lo, cashflows) * _npv(mid, cashflows) <= 0:
            hi = mid
        else:
            lo = mid
        if hi - lo < 1e-14:
            break
    return (lo + hi) / 2


class FundPoint(BaseModel):
    period: str
    calls: float
    distributions: float
    nav: float
    cumulative_net: float


class FundMetrics(BaseModel):
    called: float
    distributed: float
    nav: float
    dpi: float
    tvpi: float
    net_irr: float
    series: list[FundPoint]


def fund_metrics(rows: Sequence[dict]) -> FundMetrics:
    """DPI, TVPI and net IRR from ordered periodic calls, distributions and NAV."""
    called = sum(r["calls"] for r in rows)
    distributed = sum(r["distributions"] for r in rows)
    nav = rows[-1]["nav"]
    flows = [r["distributions"] - r["calls"] for r in rows]
    flows[-1] += nav
    series: list[FundPoint] = []
    running = 0.0
    for r in rows:
        running += r["distributions"] - r["calls"]
        series.append(
            FundPoint(
                period=r["period"],
                calls=r["calls"],
                distributions=r["distributions"],
                nav=r["nav"],
                cumulative_net=running,
            )
        )
    return FundMetrics(
        called=called,
        distributed=distributed,
        nav=nav,
        dpi=distributed / called,
        tvpi=(distributed + nav) / called,
        net_irr=irr(flows),
        series=series,
    )
