from typing import Annotated

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app import enrichers
from app import models as m
from app.jobs.memo_draft import MEMO_SECTIONS, memo_section_label
from app.repositories.repository import Repository
from app.routers.factory import MAX_ROWS, get_read_session
from app.schemas import MemoOutline, MemoSectionOutline
from app.services import pipeline

router = APIRouter(prefix="/api", tags=["pipeline"])


@router.get("/pipeline-summary", response_model=pipeline.PipelineSummary)
def pipeline_summary(session: Annotated[Session, Depends(get_read_session)]) -> pipeline.PipelineSummary:
    deals = enrichers.deals(session, Repository(m.Deal, session).list(limit=MAX_ROWS).items, False)
    return pipeline.summarise(
        [
            pipeline.Scored(
                stage=d.stage,
                ask_multiple=d.ask_multiple,
                segment_id=d.segment.id,
                segment_short=d.segment.short,
                score=d.screening.score,
                verdict=d.screening.verdict,
            )
            for d in deals
        ]
    )


@router.get("/memo-outline", response_model=MemoOutline)
def memo_outline() -> MemoOutline:
    return MemoOutline(
        sections=[
            MemoSectionOutline(key=k, label=memo_section_label(k), description=d)
            for k, d in MEMO_SECTIONS.items()
        ]
    )
