"""Resource enrichers: derived values attached on read, batch-loaded once per request."""

from typing import Any

from sqlmodel import Session, select

from app import models as m
from app.compute.lbo import DebtCapacityResponse
from app.context import DealContext, Reference, by_id, load_deals
from app.schemas import (
    CompanyRef,
    DealDetail,
    DealListItem,
    FacilityWithHeadroom,
    FundWithMetrics,
    PortfolioCompanyListItem,
    ScreeningDetail,
    ScreeningSummary,
    SegmentRef,
)
from app.services import credit, finance, screening

Rows = list[dict[str, Any]]


def company_ref(company: m.Company) -> CompanyRef:
    return CompanyRef(
        name=company.name, hq=company.hq, description=company.description, segment_id=company.segment_id
    )


def segment_ref(segment: m.Segment) -> SegmentRef:
    return SegmentRef(
        id=segment.id, name=segment.name, short=segment.short, median_multiple=segment.median_multiple
    )


def with_company(session: Session, items: list[Any], detail: bool = False) -> Rows:
    """Rows carrying their `company`; the resource's read model validates them."""
    companies = by_id(session, m.Company, (i.company_id for i in items))
    return [{**i.model_dump(), "company": company_ref(companies[i.company_id])} for i in items]


def _screen(ref: Reference, ctx: DealContext) -> screening.ScreeningResult:
    metrics = screening.DealMetrics.model_validate(ctx.screening_inputs())
    return screening.score_deal(metrics, ref.criteria, ref.thresholds)


def deals(session: Session, items: list[m.Deal], detail: bool) -> list[DealListItem]:
    """Deals with company, segment, financials and screening; detail adds the diligence pack."""
    ref = Reference.load(session)
    watched = set(
        session.exec(
            select(m.WatchlistEntry.deal_id).where(
                m.WatchlistEntry.deal_id.in_({d.id for d in items})  # type: ignore[attr-defined]
            )
        )
    )
    rows: list[DealListItem] = []
    for ctx in load_deals(session, items):
        result = _screen(ref, ctx)
        base = {
            **ctx.deal.model_dump(),
            "company": company_ref(ctx.company),
            "segment": segment_ref(ctx.segment),
            "financials": ctx.financials,
            "watchlisted": ctx.deal.id in watched,
        }
        if not detail:
            rows.append(
                DealListItem(
                    **base,
                    screening=ScreeningSummary(
                        score=result.score, verdict=result.verdict, gate_reason=result.gate_reason
                    ),
                )
            )
            continue
        deal_id = ctx.deal.id
        risk_inputs = screening.RiskInputs.model_validate(ctx.screening_inputs())
        flags = session.exec(select(m.RiskFlag).where(m.RiskFlag.deal_id == deal_id)).all()
        questions = session.exec(select(m.DiligenceQuestion).where(m.DiligenceQuestion.deal_id == deal_id))
        rows.append(
            DealDetail(
                **base,
                screening=ScreeningDetail(
                    score=result.score,
                    verdict=result.verdict,
                    gate_reason=result.gate_reason,
                    criteria=result.criteria,
                ),
                risks=screening.risk_checks(risk_inputs, ref.risk_bands),
                flags=list(flags),
                questions=[q.text for q in questions],
                debt_capacity=DebtCapacityResponse(**ref.debt_capacity(ctx.financials.ebitda)),
            )
        )
    return rows


def portfolio_companies(
    session: Session, items: list[m.PortfolioCompany], detail: bool
) -> list[PortfolioCompanyListItem]:
    """Portfolio companies with company, segment, MOIC, budget variance and debt facility headroom."""
    companies = by_id(session, m.Company, (i.company_id for i in items))
    segments = by_id(session, m.Segment, (c.segment_id for c in companies.values()))
    facilities = {
        f.company_id: f
        for f in session.exec(
            select(m.DebtFacility).where(m.DebtFacility.company_id.in_({i.company_id for i in items}))  # type: ignore[attr-defined]
        )
    }
    rows: list[PortfolioCompanyListItem] = []
    for item in items:
        company = companies[item.company_id]
        facility = facilities[item.company_id]
        rows.append(
            PortfolioCompanyListItem(
                **item.model_dump(),
                company=company_ref(company),
                segment=segment_ref(segments[company.segment_id]),  # type: ignore[index]
                moic=item.fair_value / item.invested,
                budget_variance=item.ebitda_ltm / item.ebitda_budget - 1,
                facility=FacilityWithHeadroom(
                    **facility.model_dump(),
                    headroom=credit.covenant_headroom(facility.test_level, facility.actual),
                ),
            )
        )
    return rows


def funds(session: Session, items: list[m.Fund], detail: bool) -> list[FundWithMetrics]:
    """Funds with DPI, TVPI and net IRR from the cash flow history."""
    cashflows = session.exec(select(m.FundCashflow).order_by(m.FundCashflow.period)).all()
    metrics = finance.fund_metrics([{**c.model_dump(), "period": str(c.period)} for c in cashflows])
    return [FundWithMetrics(**f.model_dump(), metrics=metrics) for f in items]
