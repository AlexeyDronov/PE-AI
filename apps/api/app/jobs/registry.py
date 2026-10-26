from app.jobs.market_research import (
    MarketResearchInput,
    MarketResearchResult,
    persist_market_research,
)
from app.jobs.memo_draft import MemoDraftInput, MemoDraftResult, persist_memo_draft
from app.jobs.spec import JobKindSpec
from app.jobs.teaser_screen import TeaserScreenInput, TeaserScreenResult, persist_teaser_screen

JOB_KINDS: dict[str, JobKindSpec] = {
    "market_research": JobKindSpec(
        "market_research",
        MarketResearchInput,
        MarketResearchResult,
        persist_market_research,
        ("research-reports", "jobs"),
    ),
    "teaser_screen": JobKindSpec(
        "teaser_screen",
        TeaserScreenInput,
        TeaserScreenResult,
        persist_teaser_screen,
        ("deals", "companies", "teasers", "jobs"),
    ),
    "memo_draft": JobKindSpec(
        "memo_draft",
        MemoDraftInput,
        MemoDraftResult,
        persist_memo_draft,
        ("memos", "memo-sections", "jobs"),
    ),
}
