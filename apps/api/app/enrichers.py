"""Resource enrichers: derived values attached on read, batch-loaded once per request."""

from typing import Any

from sqlmodel import Session, select

from app import models as m
from app.compute.lbo import DebtCapacityResponse
from app.context import DealContext, Reference, by_id, load_deals
from app.jobs.memo_draft import MEMO_SECTIONS, memo_section_label
from app.schemas import (
    AlertListItem,
    CompanyRef,
    DealDetail,
    DealListItem,
    DebtFacilityListItem,
    ExitPlanListItem,
    ExitPlanSummary,
    ExitRoutePcts,
    FacilityWithHeadroom,
    FindingWithRefs,
    FundWithMetrics,
    MemoDetail,
    MemoSectionRead,
    PlatformRef,
    Player,
    PortfolioCompanyDetail,
    PortfolioCompanyListItem,
    QuarterPoint,
    ResearchReportDetail,
    ScreeningDetail,
    ScreeningSummary,
    SegmentDetail,
    SegmentListItem,
    SegmentRef,
    SourceRef,
    ValueCreationPoint,
)
from app.services import credit, finance, market, portfolio, screening

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


def with_segment(session: Session, items: list[Any], detail: bool = False) -> Rows:
    """Rows carrying their `segment`; the resource's read model validates them."""
    segments = by_id(session, m.Segment, (i.segment_id for i in items))
    return [{**i.model_dump(), "segment": segment_ref(segments[i.segment_id])} for i in items]


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


def debt_facilities(
    session: Session, items: list[m.DebtFacility], detail: bool
) -> list[DebtFacilityListItem]:
    """Debt facilities with company, covenant headroom and its band against the comfort threshold."""
    comfort = Reference.load(session).covenant_comfort
    companies = by_id(session, m.Company, (i.company_id for i in items))
    rows: list[DebtFacilityListItem] = []
    for item in items:
        headroom = credit.covenant_headroom(item.test_level, item.actual)
        rows.append(
            DebtFacilityListItem(
                **item.model_dump(),
                headroom=headroom,
                band=credit.covenant_band(headroom, comfort),
                company=company_ref(companies[item.company_id]),
            )
        )
    return rows


def portfolio_companies(
    session: Session, items: list[m.PortfolioCompany], detail: bool
) -> list[PortfolioCompanyListItem]:
    """Portfolio companies with MOIC, budget variance and facility headroom; detail adds the page bundle."""
    company_ids = {i.company_id for i in items}
    companies = by_id(session, m.Company, company_ids)
    segments = by_id(session, m.Segment, (c.segment_id for c in companies.values()))
    facilities = {
        f.company_id: f
        for f in session.exec(
            select(m.DebtFacility).where(m.DebtFacility.company_id.in_(company_ids))  # type: ignore[attr-defined]
        )
    }
    rows: list[PortfolioCompanyListItem] = []
    for item in items:
        company = companies[item.company_id]
        facility = facilities[item.company_id]
        base = {
            **item.model_dump(),
            "company": company_ref(company),
            "segment": segment_ref(segments[company.segment_id]),  # type: ignore[index]
            "moic": item.fair_value / item.invested,
            "budget_variance": item.ebitda_ltm / item.ebitda_budget - 1,
            "facility": FacilityWithHeadroom(
                **facility.model_dump(),
                headroom=credit.covenant_headroom(facility.test_level, facility.actual),
            ),
            "status_label": portfolio.STATUS_LABELS[item.status],
        }
        if not detail:
            rows.append(PortfolioCompanyListItem(**base))
            continue
        cid = item.company_id
        points = session.exec(
            select(m.KpiPoint).where(m.KpiPoint.company_id == cid).order_by(m.KpiPoint.period)  # type: ignore[arg-type]
        ).all()
        series: dict[str, dict[str, float]] = {}
        for p in points:
            series.setdefault(p.period, {})[p.metric] = p.value
        levers = session.exec(select(m.ValueCreationItem).where(m.ValueCreationItem.company_id == cid))
        alerts = session.exec(select(m.Alert).where(m.Alert.company_id == cid)).all()
        exit_plan = session.exec(select(m.ExitPlan).where(m.ExitPlan.company_id == cid)).one()
        rows.append(
            PortfolioCompanyDetail(
                **base,
                quarters=[
                    QuarterPoint(period=period, ebitda=v["ebitda"], ebitda_budget=v["ebitda_budget"])
                    for period, v in series.items()
                ],
                value_creation=[ValueCreationPoint(lever=v.lever, amount=v.amount) for v in levers],
                alerts=[AlertListItem.model_validate(r) for r in with_company(session, list(alerts))],
                exit_plan=ExitPlanSummary(
                    route=exit_plan.route, buyers=exit_plan.buyers, window=exit_plan.window
                ),
            )
        )
    return rows


def exit_plans(session: Session, items: list[m.ExitPlan], detail: bool) -> list[ExitPlanListItem]:
    """Exit plans with company and the platform's MOIC, fair value and status."""
    holdings = {
        h.company_id: h
        for h in session.exec(
            select(m.PortfolioCompany).where(
                m.PortfolioCompany.company_id.in_({i.company_id for i in items})  # type: ignore[attr-defined]
            )
        )
    }
    rows: list[ExitPlanListItem] = []
    for row in with_company(session, items):
        h = holdings[row["company_id"]]
        platform = PlatformRef(
            id=h.id,
            moic=h.fair_value / h.invested,
            fair_value=h.fair_value,
            status=h.status,
            status_label=portfolio.STATUS_LABELS[h.status],
        )
        rows.append(ExitPlanListItem(**row, platform=platform))
    return rows


def funds(session: Session, items: list[m.Fund], detail: bool) -> list[FundWithMetrics]:
    """Funds with DPI, TVPI and net IRR from the cash flow history."""
    cashflows = session.exec(select(m.FundCashflow).order_by(m.FundCashflow.period)).all()
    rows = [{**c.model_dump(), "period": str(c.period)} for c in cashflows]
    return [
        FundWithMetrics(
            **f.model_dump(),
            metrics=finance.fund_metrics(rows, f.pref_rate, f.carry, f.catch_up, f.as_of.year),
        )
        for f in items
    ]


def segments(session: Session, items: list[m.Segment], detail: bool) -> list[SegmentListItem]:
    """Segments with ordered attribute scores and attractiveness; detail adds the segment page bundle."""
    ids = {i.id for i in items}
    scores: dict[str, list[market.Attribute]] = {}
    for r in session.exec(
        select(m.SegmentAttributeScore).where(m.SegmentAttributeScore.segment_id.in_(ids))  # type: ignore[attr-defined]
    ):
        scores.setdefault(r.segment_id, []).append(market.Attribute(attribute=r.attribute, score=r.score))
    rows: list[SegmentListItem] = []
    for item in items:
        attributes = market.order_attributes(scores.get(item.id, []))
        total, maximum = market.attractiveness(attributes)
        base = {
            **item.model_dump(),
            "attributes": attributes,
            "attractiveness": total,
            "attractiveness_max": maximum,
        }
        if not detail:
            rows.append(SegmentListItem(**base))
            continue
        company_ids = {c.id for c in session.exec(select(m.Company).where(m.Company.segment_id == item.id))}
        in_segment = m.Company.id.in_(company_ids)  # type: ignore[attr-defined]
        names = {c.id: c.name for c in session.exec(select(m.Company).where(in_segment))}
        holdings = session.exec(
            select(m.PortfolioCompany).where(
                m.PortfolioCompany.company_id.in_(company_ids)  # type: ignore[attr-defined]
            )
        ).all()
        pipeline = session.exec(
            select(m.Deal).where(m.Deal.company_id.in_(company_ids))  # type: ignore[attr-defined]
        ).all()
        mix = session.exec(select(m.ExitRouteMix).where(m.ExitRouteMix.segment_id == item.id)).one()
        rows.append(
            SegmentDetail(
                **base,
                exit_route_mix=ExitRoutePcts(**mix.model_dump()),
                transactions=list(
                    session.exec(
                        select(m.Transaction)
                        .where(m.Transaction.segment_id == item.id)
                        .order_by(m.Transaction.date.desc())  # type: ignore[attr-defined]
                    )
                ),
                players=[
                    *(Player(id=h.id, name=names[h.company_id], kind="portfolio") for h in holdings),
                    *(Player(id=d.id, name=names[d.company_id], kind="pipeline") for d in pipeline),
                ],
                matching_deals=deals(session, list(pipeline), False),
                reports=list(
                    session.exec(select(m.ResearchReport).where(m.ResearchReport.segment_id == item.id))
                ),
            )
        )
    return rows


def research_reports(session: Session, items: list[m.ResearchReport], detail: bool) -> list[Any]:
    """Reports as stored; detail adds findings with numbered source refs and the numbered sources."""
    if not detail:
        return items
    rows: list[Any] = []
    for item in items:
        findings = session.exec(
            select(m.ResearchFinding)
            .where(m.ResearchFinding.report_id == item.id)
            .order_by(m.ResearchFinding.created_at, m.ResearchFinding.id)  # type: ignore[arg-type]
        ).all()
        sources = by_id(session, m.Source, (sid for f in findings for sid in f.source_ids))
        numbers: dict[str, int] = {}
        for f in findings:
            for sid in f.source_ids:
                numbers.setdefault(sid, len(numbers) + 1)
        rows.append(
            ResearchReportDetail(
                **item.model_dump(),
                findings=[
                    FindingWithRefs(
                        **f.model_dump(exclude={"source_ids"}), refs=[numbers[s] for s in f.source_ids]
                    )
                    for f in findings
                ],
                sources=[
                    SourceRef(ref=n, **sources[sid].model_dump(include=set(SourceRef.model_fields) - {"ref"}))
                    for sid, n in numbers.items()
                ],
            )
        )
    return rows


def memos(session: Session, items: list[m.Memo], detail: bool) -> list[Any]:
    """Memos as stored; detail adds the scenario name and the sections in outline order."""
    if not detail:
        return items
    scenarios = by_id(session, m.LboScenario, (i.scenario_id for i in items if i.scenario_id))
    order = list(MEMO_SECTIONS)
    rows: list[Any] = []
    for item in items:
        sections = sorted(
            session.exec(select(m.MemoSection).where(m.MemoSection.memo_id == item.id)),
            key=lambda s: order.index(s.key),
        )
        scenario = scenarios.get(item.scenario_id) if item.scenario_id else None
        rows.append(
            MemoDetail(
                **item.model_dump(),
                scenario_name=scenario.name if scenario else None,
                sections=[
                    MemoSectionRead(
                        id=s.id,
                        key=s.key,
                        label=memo_section_label(s.key),
                        status=s.status,
                        markdown=s.markdown,
                    )
                    for s in sections
                ],
            )
        )
    return rows
