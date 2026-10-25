"""Portfolio roll-ups: status labels, the invested-to-fair-value bridge and covenant summary."""

from collections.abc import Sequence

from pydantic import BaseModel

STATUS_LABELS = {"good": "On plan", "warn": "Watch", "bad": "Action", "acc": "Exit prep"}

ROUTE_GROUPS = {"Recapitalise": "Recap"}


class Holding(BaseModel):
    invested: float
    fair_value: float
    status: str


class Lever(BaseModel):
    lever: str
    amount: float


class BridgeStep(BaseModel):
    label: str
    value: float


class PortfolioSummary(BaseModel):
    platforms: int
    invested: float
    fair_value: float
    moic: float
    status_counts: dict[str, int]
    value_bridge: list[BridgeStep]


class Facility(BaseModel):
    company: str
    headroom: float
    next_test_date: str


class Tightest(BaseModel):
    company: str
    headroom: float


class CovenantSummary(BaseModel):
    facilities: int
    below_comfort: int
    comfort_threshold: float
    next_test_date: str | None
    tightest: Tightest | None


class ExitSummary(BaseModel):
    platforms: int
    exit_prep: int
    exit_prep_fair_value: float
    routes: dict[str, int]


class ExitPlanInput(BaseModel):
    route: str
    status: str
    fair_value: float


def summarise_exits(plans: Sequence[ExitPlanInput]) -> ExitSummary:
    """Platforms in exit prep with their fair value, and plans counted by route group."""
    prep = [p for p in plans if p.status == "acc"]
    routes: dict[str, int] = {}
    for p in plans:
        group = p.route.split()[0]
        group = ROUTE_GROUPS.get(group, group)
        routes[group] = routes.get(group, 0) + 1
    return ExitSummary(
        platforms=len(plans),
        exit_prep=len(prep),
        exit_prep_fair_value=sum(p.fair_value for p in prep),
        routes=routes,
    )


def summarise_portfolio(holdings: Sequence[Holding], levers: Sequence[Lever]) -> PortfolioSummary:
    """Totals, status mix and a bridge from invested to fair value, balanced with an Other step."""
    invested = sum(h.invested for h in holdings)
    fair_value = sum(h.fair_value for h in holdings)
    by_lever: dict[str, float] = {}
    for item in levers:
        by_lever[item.lever] = by_lever.get(item.lever, 0.0) + item.amount
    steps = [BridgeStep(label=label, value=value) for label, value in by_lever.items()]
    gap = fair_value - invested - sum(by_lever.values())
    if abs(gap) > 1e-9:
        steps.append(BridgeStep(label="Other", value=gap))
    return PortfolioSummary(
        platforms=len(holdings),
        invested=invested,
        fair_value=fair_value,
        moic=fair_value / invested if invested else 0.0,
        status_counts={s: sum(h.status == s for h in holdings) for s in STATUS_LABELS},
        value_bridge=[
            BridgeStep(label="Invested", value=invested),
            *steps,
            BridgeStep(label="Fair value", value=fair_value),
        ],
    )


def summarise_covenants(facilities: Sequence[Facility], comfort: float) -> CovenantSummary:
    """Facilities below the comfort threshold, the next test date and the tightest headroom."""
    tightest = min(facilities, key=lambda f: f.headroom, default=None)
    return CovenantSummary(
        facilities=len(facilities),
        below_comfort=sum(f.headroom < comfort for f in facilities),
        comfort_threshold=comfort,
        next_test_date=min((f.next_test_date for f in facilities), default=None),
        tightest=Tightest(company=tightest.company, headroom=tightest.headroom) if tightest else None,
    )
