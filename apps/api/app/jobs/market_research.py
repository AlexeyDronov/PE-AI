from typing import Literal

from pydantic import BaseModel, Field, model_validator
from sqlmodel import Session, SQLModel

from app.models import Job, ResearchFinding, ResearchReport, Source
from app.models.base import utcnow

CONFIDENCE = {"low": 0.3, "medium": 0.6, "high": 0.9}


class MarketResearchInput(BaseModel):
    question: str = Field(min_length=1)
    segment_id: str | None = None


class FindingIn(BaseModel):
    metric: str
    value: float
    unit: str
    period: str
    confidence: Literal["low", "medium", "high"]
    source_refs: list[int] = Field(min_length=1)


class SourceIn(BaseModel):
    ref: int
    url: str
    title: str
    publisher: str
    excerpt: str


class MarketResearchResult(BaseModel):
    summary: str
    findings: list[FindingIn]
    sources: list[SourceIn]

    @model_validator(mode="after")
    def _refs_resolve(self) -> "MarketResearchResult":
        known = {s.ref for s in self.sources}
        for f in self.findings:
            if not set(f.source_refs) <= known:
                raise ValueError(f"finding '{f.metric}' cites unknown source refs")
        return self


def persist_market_research(session: Session, job: Job, result: MarketResearchResult) -> ResearchReport:
    job_input = job.input
    report = ResearchReport(
        source="agent",
        segment_id=job_input.get("segment_id"),
        question=job_input["question"],
        summary=result.summary,
        status="complete",
    )
    sources = {
        s.ref: Source(source="agent", retrieved_at=utcnow(), **s.model_dump(exclude={"ref"}))
        for s in result.sources
    }
    session.add(report)
    session.add_all(sources.values())
    session.add_all(
        ResearchFinding(
            source="agent",
            report_id=report.id,
            source_ids=[sources[r].id for r in f.source_refs],
            confidence=CONFIDENCE[f.confidence],
            **f.model_dump(exclude={"source_refs", "confidence"}),
        )
        for f in result.findings
    )
    return report


class NotBuilt(BaseModel):
    """Placeholder result contract for kinds whose agent workflow is a later task."""


def persist_not_built(session: Session, job: Job, result: BaseModel) -> SQLModel:
    raise NotImplementedError(f"Results for '{job.kind}' jobs are not implemented yet")
