from datetime import date, datetime

from sqlalchemy import JSON, Column
from sqlmodel import Field

from app.models.base import Base, Writable


class Segment(Base, table=True):
    __tablename__ = "segments"
    name: str
    short: str
    market_size: float
    cagr: float
    avg_margin: float
    fragmentation: str
    ai_exposure: str
    median_multiple: float
    addon_multiple: float
    typical_leverage: float
    deal_count_24m: int
    view: str
    white_space: str


class SegmentAttributeScore(Base, table=True):
    __tablename__ = "segment_attribute_scores"
    segment_id: str = Field(index=True)
    attribute: str
    score: int


class ExitRouteMix(Base, table=True):
    __tablename__ = "exit_route_mixes"
    segment_id: str = Field(index=True)
    strategic_pct: float
    sponsor_pct: float
    ipo_pct: float


class Transaction(Base, table=True):
    __tablename__ = "transactions"
    date: date
    target: str
    acquirer: str
    segment_id: str = Field(index=True)
    ev: float
    ev_ebitda: float
    route: str


class ResearchReport(Writable, table=True):
    __tablename__ = "research_reports"
    segment_id: str | None = Field(default=None, index=True)
    question: str
    summary: str
    status: str
    model: str | None = None


class ResearchFinding(Writable, table=True):
    __tablename__ = "research_findings"
    report_id: str = Field(index=True)
    metric: str
    value: float
    unit: str
    period: str
    confidence: str  # low | medium | high, as the agent reported it
    source_ids: list[str] = Field(default_factory=list, sa_column=Column(JSON))


class Source(Writable, table=True):
    __tablename__ = "sources"
    url: str
    title: str
    publisher: str
    retrieved_at: datetime
    excerpt: str
