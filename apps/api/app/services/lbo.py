"""LBO engine: sources and uses, debt schedule, returns and value bridge."""

from typing import Literal

from pydantic import BaseModel, ConfigDict

STRESS_DROP = 0.225

# Per-case shifts applied to the base assumptions.
CASE_DELTAS: dict[str, dict[str, float]] = {
    "down": {"growth": -0.03, "margin_bp": -50.0, "exit_multiple": -1.0},
    "up": {"growth": 0.03, "margin_bp": 50.0, "exit_multiple": 1.0},
}


class LboAssumptions(BaseModel):
    model_config = ConfigDict(frozen=True)

    revenue0: float
    ebitda0: float
    entry_multiple: float
    exit_multiple: float
    total_leverage: float
    senior_leverage: float
    rate_senior: float
    rate_sub: float
    tx_fee_pct: float
    fin_fee_pct: float
    min_cash: float
    tax_rate: float
    revenue_growth: list[float]
    margin_change_bp: float
    capex_pct: float
    da_pct: float
    nwc_pct: float
    sweep: float
    mgmt_rollover: float
    years: int = 5


class SourcesUses(BaseModel):
    enterprise_value: float
    transaction_fees: float
    financing_fees: float
    min_cash: float
    total_uses: float
    senior_debt: float
    sub_debt: float
    rollover_equity: float
    sponsor_equity: float
    total_sources: float


class YearResult(BaseModel):
    year: int
    revenue: float
    margin: float
    ebitda: float
    da: float
    capex: float
    nwc: float
    interest: float
    tax: float
    free_cash_flow: float
    repayment: float
    senior_close: float
    sub_close: float
    cash: float


class Returns(BaseModel):
    exit_ev: float
    exit_net_debt: float
    exit_equity: float
    sponsor_exit_equity: float
    moic: float
    irr: float


class CreditStats(BaseModel):
    total_leverage: float
    senior_leverage: float
    interest_cover: float
    debt_share: float
    stressed_cover: float


class BridgeItem(BaseModel):
    label: str
    value: float


class LboResult(BaseModel):
    sources_uses: SourcesUses
    schedule: list[YearResult]
    returns: Returns
    credit: CreditStats
    bridge: list[BridgeItem]


class Grid(BaseModel):
    entry: list[float]
    exit: list[float]
    irr: list[list[float]]


def _validate(a: LboAssumptions) -> None:
    if a.senior_leverage > a.total_leverage:
        raise ValueError("senior leverage cannot exceed total leverage")
    if a.total_leverage * a.ebitda0 >= a.entry_multiple * a.ebitda0:
        raise ValueError("total debt must be below enterprise value")
    if len(a.revenue_growth) != a.years:
        raise ValueError("revenue_growth must cover every year")


def run_lbo(a: LboAssumptions) -> LboResult:
    """Run the full LBO: structure, yearly cash waterfall, exit returns and value bridge."""
    _validate(a)
    ev = a.entry_multiple * a.ebitda0
    debt = a.total_leverage * a.ebitda0
    senior0 = a.senior_leverage * a.ebitda0
    sub = debt - senior0
    tx = a.tx_fee_pct * ev
    fin = a.fin_fee_pct * debt
    total_uses = ev + tx + fin + a.min_cash
    equity = total_uses - debt
    rollover = a.mgmt_rollover * equity
    sponsor = equity - rollover
    su = SourcesUses(
        enterprise_value=ev,
        transaction_fees=tx,
        financing_fees=fin,
        min_cash=a.min_cash,
        total_uses=total_uses,
        senior_debt=senior0,
        sub_debt=sub,
        rollover_equity=rollover,
        sponsor_equity=sponsor,
        total_sources=debt + rollover + sponsor,
    )

    schedule: list[YearResult] = []
    revenue, margin, senior, cash = a.revenue0, a.ebitda0 / a.revenue0, senior0, a.min_cash
    first_interest = 0.0
    for t, g in enumerate(a.revenue_growth, start=1):
        prev_revenue = revenue
        revenue = prev_revenue * (1 + g)
        margin += a.margin_change_bp / 10000
        ebitda = revenue * margin
        da = a.da_pct * revenue
        capex = a.capex_pct * revenue
        nwc = a.nwc_pct * (revenue - prev_revenue)
        interest = senior * a.rate_senior + sub * a.rate_sub
        tax = max(0.0, ebitda - da - interest) * a.tax_rate
        fcf = ebitda - interest - tax - capex - nwc
        repay = min(senior, max(0.0, fcf) * a.sweep)
        senior -= repay
        cash += fcf - repay
        if t == 1:
            first_interest = interest
        schedule.append(
            YearResult(
                year=t,
                revenue=revenue,
                margin=margin,
                ebitda=ebitda,
                da=da,
                capex=capex,
                nwc=nwc,
                interest=interest,
                tax=tax,
                free_cash_flow=fcf,
                repayment=repay,
                senior_close=senior,
                sub_close=sub,
                cash=cash,
            )
        )

    last = schedule[-1]
    exit_ev = a.exit_multiple * last.ebitda
    exit_net_debt = last.senior_close + sub - last.cash
    exit_equity = exit_ev - exit_net_debt
    sponsor_exit = exit_equity * sponsor / equity
    moic = sponsor_exit / sponsor
    returns = Returns(
        exit_ev=exit_ev,
        exit_net_debt=exit_net_debt,
        exit_equity=exit_equity,
        sponsor_exit_equity=sponsor_exit,
        moic=moic,
        irr=moic ** (1 / a.years) - 1 if moic > 0 else -1.0,
    )
    first = schedule[0]
    credit = CreditStats(
        total_leverage=a.total_leverage,
        senior_leverage=a.senior_leverage,
        interest_cover=first.ebitda / first_interest,
        debt_share=debt / (debt + equity),
        stressed_cover=first.ebitda * (1 - STRESS_DROP) / first_interest,
    )
    bridge = [
        BridgeItem(label="Entry equity", value=equity),
        BridgeItem(label="EBITDA growth", value=(last.ebitda - a.ebitda0) * a.entry_multiple),
        BridgeItem(label="Multiple", value=(a.exit_multiple - a.entry_multiple) * last.ebitda),
        BridgeItem(label="Debt paydown and cash", value=(debt - a.min_cash) - exit_net_debt),
        BridgeItem(label="Fees", value=-(tx + fin)),
        BridgeItem(label="Exit equity", value=exit_equity),
    ]
    return LboResult(sources_uses=su, schedule=schedule, returns=returns, credit=credit, bridge=bridge)


def growth_path(y1: float, terminal: float, years: int) -> list[float]:
    """Linear fade from the first-year growth rate to the terminal rate."""
    if years == 1:
        return [y1]
    return [y1 + (terminal - y1) * i / (years - 1) for i in range(years)]


def apply_case(a: LboAssumptions, case: Literal["base", "down", "up"]) -> LboAssumptions:
    """Return assumptions shifted for the base, downside or upside case."""
    if case == "base":
        return a
    d = CASE_DELTAS[case]
    return a.model_copy(
        update={
            "revenue_growth": [g + d["growth"] for g in a.revenue_growth],
            "margin_change_bp": a.margin_change_bp + d["margin_bp"],
            "exit_multiple": a.exit_multiple + d["exit_multiple"],
        }
    )


def sensitivity(a: LboAssumptions, entry: list[float], exit: list[float]) -> Grid:  # noqa: A002
    """Sponsor IRR for each entry (rows) and exit (columns) multiple."""
    return Grid(
        entry=entry,
        exit=exit,
        irr=[
            [
                run_lbo(a.model_copy(update={"entry_multiple": en, "exit_multiple": ex})).returns.irr
                for ex in exit
            ]
            for en in entry
        ],
    )


def max_entry_multiple(a: LboAssumptions, hurdle: float) -> float:
    """Highest entry multiple that still delivers the hurdle IRR (bisection)."""

    def irr_at(m: float) -> float:
        return run_lbo(a.model_copy(update={"entry_multiple": m})).returns.irr

    lo, hi = a.total_leverage + 0.01, 50.0
    if irr_at(lo) < hurdle:
        raise ValueError("hurdle cannot be met at any entry multiple")
    for _ in range(100):
        mid = (lo + hi) / 2
        if irr_at(mid) >= hurdle:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2
