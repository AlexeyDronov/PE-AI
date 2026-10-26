from pydantic import BaseModel, Field, field_validator
from sqlmodel import Session

from app.core.errors import InvalidInput
from app.models import Job, Memo, MemoSection

# Ordered section keys with a one-line guide to each.
MEMO_SECTIONS: dict[str, str] = {
    "summary": "Deal overview, headline numbers and the recommendation in brief",
    "thesis": "Why this is an attractive buyout and where value creation comes from",
    "market": "Segment size, growth, competition and positioning",
    "financials": "Revenue, EBITDA, margins, cash conversion and quality of earnings",
    "valuation": "Entry price, leverage, LBO returns versus the hurdle and sensitivity",
    "risks": "Key risks, severity and mitigants",
    "recommendation": "Advance, watch or pass, with next steps and diligence priorities",
}


def _known(keys: list[str]) -> list[str]:
    for key in keys:
        if key not in MEMO_SECTIONS:
            raise ValueError(f"unknown section '{key}'")
    return keys


class MemoDraftInput(BaseModel):
    deal_id: str
    scenario_id: str | None = None
    sections: list[str] = Field(min_length=1)

    @field_validator("sections")
    @classmethod
    def _valid_sections(cls, sections: list[str]) -> list[str]:
        if len(set(sections)) != len(sections):
            raise ValueError("sections must be unique")
        return _known(sections)


class SectionIn(BaseModel):
    key: str
    markdown: str = Field(min_length=1, max_length=8000)

    @field_validator("key")
    @classmethod
    def _valid_key(cls, key: str) -> str:
        return _known([key])[0]


class MemoDraftResult(BaseModel):
    sections: list[SectionIn]


def persist_memo_draft(session: Session, job: Job, result: MemoDraftResult) -> Memo:
    requested: list[str] = job.input["sections"]
    got = [s.key for s in result.sections]
    if len(set(got)) != len(got) or set(got) != set(requested):
        raise InvalidInput(f"Result sections must be exactly the requested sections: {', '.join(requested)}")
    memo = Memo(
        source="agent", deal_id=job.input["deal_id"], scenario_id=job.input.get("scenario_id"), status="draft"
    )
    session.add(memo)
    by_key = {s.key: s.markdown for s in result.sections}
    session.add_all(
        MemoSection(source="agent", memo_id=memo.id, key=k, markdown=by_key[k], status="draft")
        for k in requested
    )
    return memo
