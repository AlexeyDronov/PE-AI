from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from typing import Any

from pydantic import BaseModel
from sqlmodel import Session, SQLModel

from app import enrichers
from app import models as m
from app import schemas as s

Enricher = Callable[[Session, list[Any], bool], list[dict[str, Any]]]
Computed = Mapping[str, Callable[[dict[str, Any]], Any]]


@dataclass(frozen=True)
class ResourceSpec:
    """One read resource: GET /api/{name} and /api/{name}/{id}.

    `read_schema` is the row model (the table by default) and `detail_schema` the detail route's.
    `enrich` turns a batch of rows into models, or dicts they validate; `computed_filters` and
    `computed_sorts` read a key off an enriched row and apply before pagination.
    """

    name: str
    model: type[SQLModel]
    read_schema: type[BaseModel] | None = None
    detail_schema: type[BaseModel] | None = None
    filters: tuple[str, ...] = ()
    detail_only: bool = False
    enrich: Enricher | None = None
    computed_filters: Computed = field(default_factory=dict)
    computed_sorts: Computed = field(default_factory=dict)


RESOURCES: list[ResourceSpec] = [
    ResourceSpec("funds", m.Fund, read_schema=s.FundWithMetrics, enrich=enrichers.funds),
    ResourceSpec("benchmarks", m.Benchmark, filters=("key",)),
    ResourceSpec("macro-rates", m.MacroRate, filters=("key",)),
    ResourceSpec("screening-criteria", m.ScreeningCriterion, filters=("key",)),
    ResourceSpec(
        "segments",
        m.Segment,
        filters=("short", "fragmentation", "ai_exposure"),
        read_schema=s.SegmentListItem,
        detail_schema=s.SegmentDetail,
        enrich=enrichers.segments,
        computed_sorts={"attractiveness": lambda r: r.attractiveness},
    ),
    ResourceSpec("segment-attribute-scores", m.SegmentAttributeScore, filters=("segment_id", "attribute")),
    ResourceSpec(
        "exit-route-mixes",
        m.ExitRouteMix,
        filters=("segment_id",),
        read_schema=s.ExitRouteMixListItem,
        enrich=enrichers.with_segment,
    ),
    ResourceSpec("transactions", m.Transaction, filters=("segment_id", "route")),
    ResourceSpec(
        "research-reports",
        m.ResearchReport,
        filters=("segment_id", "status", "source"),
        detail_schema=s.ResearchReportDetail,
        enrich=enrichers.research_reports,
    ),
    ResourceSpec("research-findings", m.ResearchFinding, filters=("report_id", "metric", "source")),
    ResourceSpec("sources", m.Source, filters=("source",)),
    ResourceSpec("companies", m.Company, filters=("segment_id", "source")),
    ResourceSpec(
        "deals",
        m.Deal,
        filters=("stage", "company_id", "origin", "source"),
        read_schema=s.DealListItem,
        detail_schema=s.DealDetail,
        enrich=enrichers.deals,
        computed_filters={"verdict": lambda d: d.screening.verdict},
        computed_sorts={"score": lambda d: d.screening.score},
    ),
    ResourceSpec("deal-financials", m.DealFinancials, filters=("deal_id",)),
    ResourceSpec("risk-flags", m.RiskFlag, filters=("deal_id", "severity")),
    ResourceSpec("diligence-questions", m.DiligenceQuestion, filters=("deal_id",)),
    ResourceSpec("teasers", m.Teaser, filters=("deal_id", "job_id")),
    ResourceSpec("watchlist-entries", m.WatchlistEntry, filters=("deal_id",)),
    ResourceSpec("lbo-scenarios", m.LboScenario, read_schema=s.LboScenarioRead, filters=("deal_id",)),
    ResourceSpec(
        "memos",
        m.Memo,
        filters=("deal_id", "status"),
        detail_schema=s.MemoDetail,
        enrich=enrichers.memos,
    ),
    ResourceSpec("memo-sections", m.MemoSection, filters=("memo_id", "key")),
    ResourceSpec(
        "portfolio-companies",
        m.PortfolioCompany,
        filters=("company_id", "status"),
        read_schema=s.PortfolioCompanyListItem,
        detail_schema=s.PortfolioCompanyDetail,
        enrich=enrichers.portfolio_companies,
    ),
    ResourceSpec(
        "kpi-points",
        m.KpiPoint,
        filters=("company_id", "metric", "period"),
        read_schema=s.KpiPointListItem,
        enrich=enrichers.with_company,
    ),
    ResourceSpec(
        "debt-facilities",
        m.DebtFacility,
        filters=("company_id",),
        read_schema=s.DebtFacilityListItem,
        enrich=enrichers.debt_facilities,
    ),
    ResourceSpec(
        "value-creation-items",
        m.ValueCreationItem,
        filters=("company_id",),
        read_schema=s.ValueCreationItemListItem,
        enrich=enrichers.with_company,
    ),
    ResourceSpec(
        "exit-plans",
        m.ExitPlan,
        filters=("company_id",),
        read_schema=s.ExitPlanListItem,
        enrich=enrichers.exit_plans,
    ),
    ResourceSpec(
        "alerts",
        m.Alert,
        filters=("company_id", "severity"),
        read_schema=s.AlertListItem,
        enrich=enrichers.with_company,
    ),
    ResourceSpec("fund-cashflows", m.FundCashflow, filters=("period",)),
    ResourceSpec("jobs", m.Job, filters=("kind", "status"), read_schema=s.JobRead),
    ResourceSpec("annotations", m.Annotation, filters=("status", "route"), read_schema=s.AnnotationRead),
]
