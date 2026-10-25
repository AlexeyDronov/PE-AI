"""Overview roll-up: fund headline figures, live deal count and alert mix."""

from collections.abc import Sequence

from pydantic import BaseModel

from app.services.finance import FundMetrics

DILIGENCE_STAGES = frozenset({"CIM", "IOI", "LOI", "Exclusivity", "SPA"})
SEVERITIES = ("bad", "warn", "acc")


class OverviewSummary(BaseModel):
    nav: float
    net_irr: float
    tvpi: float
    dpi: float
    dry_powder: float
    in_diligence: int
    pipeline_total: int
    alerts: dict[str, int]


def summarise_overview(
    committed: float, metrics: FundMetrics, stages: Sequence[str], severities: Sequence[str]
) -> OverviewSummary:
    """Fund NAV, returns and dry powder, deals in diligence and alerts by severity."""
    return OverviewSummary(
        nav=metrics.nav,
        net_irr=metrics.net_irr,
        tvpi=metrics.tvpi,
        dpi=metrics.dpi,
        dry_powder=committed - metrics.called,
        in_diligence=sum(s in DILIGENCE_STAGES for s in stages),
        pipeline_total=len(stages),
        alerts={sev: sum(s == sev for s in severities) for sev in SEVERITIES},
    )
