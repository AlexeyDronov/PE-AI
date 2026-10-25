from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import Field

from app.models.base import Writable


class Company(Writable, table=True):
    __tablename__ = "companies"
    name: str
    description: str
    hq: str
    segment_id: str | None = Field(default=None, index=True)
    ownership: str
    moat: str


class Deal(Writable, table=True):
    __tablename__ = "deals"
    company_id: str = Field(index=True)
    code_name: str
    stage: str = Field(index=True)
    process: str
    ask_multiple: float
    origin: str = "teaser"


class DealFinancials(Writable, table=True):
    __tablename__ = "deal_financials"
    deal_id: str = Field(index=True)
    revenue: float
    ebitda: float
    growth: float
    recurring_pct: float
    capex_pct: float
    da_pct: float
    nwc_pct: float
    top_customer_pct: float
    gross_retention: float
    cyclicality: str
    ai_resilience: int
    fragmentation: int
    key_person_risk: bool


class RiskFlag(Writable, table=True):
    __tablename__ = "risk_flags"
    deal_id: str = Field(index=True)
    severity: str
    text: str
    mitigant: str


class DiligenceQuestion(Writable, table=True):
    __tablename__ = "diligence_questions"
    deal_id: str = Field(index=True)
    text: str


class Teaser(Writable, table=True):
    __tablename__ = "teasers"
    raw_text: str
    job_id: str | None = None
    deal_id: str | None = None


class WatchlistEntry(Writable, table=True):
    __tablename__ = "watchlist_entries"
    deal_id: str = Field(index=True)
    note: str = ""


class LboScenario(Writable, table=True):
    __tablename__ = "lbo_scenarios"
    deal_id: str = Field(index=True)
    name: str
    assumptions: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))


class Memo(Writable, table=True):
    __tablename__ = "memos"
    deal_id: str = Field(index=True)
    scenario_id: str | None = None
    status: str


class MemoSection(Writable, table=True):
    __tablename__ = "memo_sections"
    memo_id: str = Field(index=True)
    key: str
    markdown: str
    status: str
