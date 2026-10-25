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
    projected: bool


class Tier(BaseModel):
    label: str
    lp: float
    gp: float


def distribution_waterfall(
    called: float, total_value: float, years: float, pref_rate: float, carry: float, catch_up: float
) -> list[Tier]:
    """European waterfall: return of capital, compounding pref, GP catch-up, then the carry split."""
    remaining = total_value
    roc = min(remaining, called)
    remaining -= roc
    pref = min(remaining, called * ((1 + pref_rate) ** years - 1))
    remaining -= pref
    catch_up_size = carry * pref / (catch_up - carry) if catch_up > carry else 0.0
    catch = min(remaining, catch_up_size)
    remaining -= catch
    return [
        Tier(label="Return of capital", lp=roc, gp=0.0),
        Tier(label="Preferred return", lp=pref, gp=0.0),
        Tier(label="GP catch-up", lp=catch * (1 - catch_up), gp=catch * catch_up),
        Tier(label="Carried interest split", lp=remaining * (1 - carry), gp=remaining * carry),
    ]


class FundMetrics(BaseModel):
    as_of_period: str
    called: float
    distributed: float
    nav: float
    dpi: float
    tvpi: float
    net_irr: float
    series: list[FundPoint]
    waterfall: list[Tier]
    gross_profit: float
    lp_total: float
    gp_carry: float


def fund_metrics(
    rows: Sequence[dict],
    pref_rate: float = 0.08,
    carry: float = 0.20,
    catch_up: float = 1.0,
    as_of_year: int | None = None,
) -> FundMetrics:
    """DPI, TVPI, net IRR and the waterfall at the as-of year; later periods are projections only."""
    as_of = as_of_year if as_of_year is not None else int(rows[-1]["period"])
    actual = [r for r in rows if int(r["period"]) <= as_of]
    called = sum(r["calls"] for r in actual)
    distributed = sum(r["distributions"] for r in actual)
    nav = actual[-1]["nav"]
    flows = [r["distributions"] - r["calls"] for r in actual]
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
                projected=int(r["period"]) > as_of,
            )
        )
    first_call = next(int(r["period"]) for r in rows if r["calls"] > 0)
    tiers = distribution_waterfall(called, distributed + nav, as_of - first_call, pref_rate, carry, catch_up)
    return FundMetrics(
        as_of_period=str(as_of),
        called=called,
        distributed=distributed,
        nav=nav,
        dpi=distributed / called,
        tvpi=(distributed + nav) / called,
        net_irr=irr(flows),
        series=series,
        waterfall=tiers,
        gross_profit=distributed + nav - called,
        lp_total=sum(t.lp for t in tiers),
        gp_carry=sum(t.gp for t in tiers),
    )
