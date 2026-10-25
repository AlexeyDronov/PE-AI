"""Loads the reference data and per-deal facts the pure services need, once per request."""

from dataclasses import dataclass
from typing import Any

from sqlmodel import Session, SQLModel, select

from app import models as m
from app.services import credit, screening


def by_id[T: SQLModel](session: Session, model: type[T], ids: Any) -> dict[str, T]:
    """Rows of `model` keyed by id, fetched in one query."""
    rows = session.exec(select(model).where(model.id.in_(set(ids)))).all()  # type: ignore[attr-defined]
    return {r.id: r for r in rows}  # type: ignore[attr-defined]


@dataclass(frozen=True)
class Reference:
    """Fund policy, benchmarks and rates."""

    fund: m.Fund
    benchmarks: dict[str, m.Benchmark]
    rates: dict[str, float]
    criteria: list[screening.Criterion]

    @classmethod
    def load(cls, session: Session) -> "Reference":
        criteria = sorted(session.exec(select(m.ScreeningCriterion)).all(), key=lambda c: (-c.weight, c.key))
        return cls(
            fund=session.exec(select(m.Fund)).one(),
            benchmarks={b.key: b for b in session.exec(select(m.Benchmark)).all()},
            rates={r.key: r.value for r in session.exec(select(m.MacroRate).order_by(m.MacroRate.as_of))},
            criteria=[
                screening.Criterion(
                    key=c.key,
                    label=c.label,
                    weight=c.weight,
                    metric=c.metric,
                    kind=c.kind,  # type: ignore[arg-type]
                    floor=c.floor,
                    ceiling=c.ceiling,
                    target_text=c.target_text,
                )
                for c in criteria
            ],
        )

    @property
    def thresholds(self) -> screening.Thresholds:
        return screening.Thresholds(
            advance=self.fund.verdict_advance,
            watch=self.fund.verdict_watch,
            gate_key="scale",
            gate_min=50,
        )

    @property
    def rate_senior(self) -> float:
        return self.rates["SONIA"] + self.benchmarks["senior_spread"].low

    @property
    def rate_sub(self) -> float:
        return self.benchmarks["sub_rate"].low

    @property
    def senior_leverage(self) -> float:
        return self.benchmarks["senior_leverage"].high or self.benchmarks["senior_leverage"].low

    @property
    def stress_drop(self) -> float:
        return self.benchmarks["stress_ebitda_drop"].low

    @property
    def covenant_comfort(self) -> float:
        return self.benchmarks["covenant_headroom_comfort"].low

    @property
    def risk_bands(self) -> dict[str, tuple[float, float]]:
        return {k: (b.low, b.high) for k, b in self.benchmarks.items() if b.high is not None}

    def debt_capacity(self, ebitda: float) -> dict[str, float]:
        """Debt capacity at fund policy, with the inputs it was computed from."""
        policy = {
            "ebitda": ebitda,
            "senior_multiple": self.senior_leverage,
            "policy_leverage": self.fund.max_leverage,
            "rate_senior": self.rate_senior,
            "rate_sub": self.rate_sub,
            "stress_drop": self.stress_drop,
            "cover_floor": self.benchmarks["interest_cover"].low,
        }
        capacity = credit.debt_capacity(**policy)
        return {**policy, **capacity.model_dump()}


@dataclass(frozen=True)
class DealContext:
    """A deal with the rows around it."""

    deal: m.Deal
    company: m.Company
    segment: m.Segment
    financials: m.DealFinancials

    def screening_inputs(self) -> dict[str, Any]:
        return {
            **self.financials.model_dump(),
            "ask_multiple": self.deal.ask_multiple,
            "segment_median_multiple": self.segment.median_multiple,
        }


def load_deals(session: Session, deals: list[m.Deal]) -> list[DealContext]:
    """Contexts for many deals using one query per table."""
    companies = by_id(session, m.Company, (d.company_id for d in deals))
    segments = by_id(session, m.Segment, (c.segment_id for c in companies.values() if c.segment_id))
    financials = {
        f.deal_id: f
        for f in session.exec(
            select(m.DealFinancials).where(m.DealFinancials.deal_id.in_({d.id for d in deals}))
        )  # type: ignore[attr-defined]
    }
    return [
        DealContext(
            d,
            companies[d.company_id],
            segments[companies[d.company_id].segment_id],  # type: ignore[index]
            financials[d.id],
        )
        for d in deals
    ]
