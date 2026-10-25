from pydantic import BaseModel, Field

from app.jobs.market_research import (
    MarketResearchInput,
    MarketResearchResult,
    NotBuilt,
    persist_market_research,
    persist_not_built,
)
from app.jobs.spec import JobKindSpec


class TeaserScreenInput(BaseModel):
    text: str = Field(min_length=1)


class MemoDraftInput(BaseModel):
    deal_id: str
    scenario_id: str | None = None
    sections: list[str]


JOB_KINDS: dict[str, JobKindSpec] = {
    "market_research": JobKindSpec(
        "market_research",
        MarketResearchInput,
        MarketResearchResult,
        persist_market_research,
        ("research-reports", "jobs"),
    ),
    "teaser_screen": JobKindSpec(
        "teaser_screen", TeaserScreenInput, NotBuilt, persist_not_built, ("deals", "jobs")
    ),
    "memo_draft": JobKindSpec("memo_draft", MemoDraftInput, NotBuilt, persist_not_built, ("memos", "jobs")),
}
