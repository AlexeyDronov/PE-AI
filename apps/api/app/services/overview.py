"""Overview roll-up: fund headline figures, live deal count and alert mix."""

from collections.abc import Sequence

from pydantic import BaseModel

from app.services.finance import FundMetrics

DILIGENCE_STAGES = frozenset({"CIM", "IOI", "LOI", "Exclusivity", "SPA"})
SEVERITIES = ("bad", "warn", "acc")


TERM_YEARS = 10
INVESTMENT_YEARS = 5


class FundLifecycle(BaseModel):
    vintage: int
    year: int
    term_years: int
    phase: str


def fund_lifecycle(vintage: int, as_of_year: int) -> FundLifecycle:
    """Fund year (vintage = year 1) and phase: investment period, harvesting, then extension."""
    year = as_of_year - vintage + 1
    phase = (
        "Investment period"
        if year <= INVESTMENT_YEARS
        else "Harvesting"
        if year <= TERM_YEARS
        else "Extension"
    )
    return FundLifecycle(vintage=vintage, year=year, term_years=TERM_YEARS, phase=phase)


class OverviewSummary(BaseModel):
    nav: float
    net_irr: float
    tvpi: float
    dpi: float
    dry_powder: float
    aum: float
    lifecycle: FundLifecycle
    in_diligence: int
    pipeline_total: int
    alerts: dict[str, int]


def summarise_overview(
    committed: float,
    vintage: int,
    as_of_year: int,
    metrics: FundMetrics,
    stages: Sequence[str],
    severities: Sequence[str],
) -> OverviewSummary:
    """Fund NAV, returns and dry powder, deals in diligence and alerts by severity."""
    return OverviewSummary(
        nav=metrics.nav,
        net_irr=metrics.net_irr,
        tvpi=metrics.tvpi,
        dpi=metrics.dpi,
        dry_powder=committed - metrics.called,
        aum=metrics.nav + committed - metrics.called,
        lifecycle=fund_lifecycle(vintage, as_of_year),
        in_diligence=sum(s in DILIGENCE_STAGES for s in stages),
        pipeline_total=len(stages),
        alerts={sev: sum(s == sev for s in severities) for sev in SEVERITIES},
    )
