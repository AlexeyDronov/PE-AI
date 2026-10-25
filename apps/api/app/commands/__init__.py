from app.commands.annotations import (
    CreateAnnotationInput,
    UpdateAnnotationInput,
    create_annotation,
    update_annotation,
)
from app.commands.research import start_market_research
from app.commands.spec import CommandSpec
from app.commands.watchlist import SetWatchlistInput, WatchlistState, set_watchlist
from app.jobs.market_research import MarketResearchInput
from app.schemas import AnnotationRead, JobRead

COMMANDS: list[CommandSpec] = [
    CommandSpec(
        "create-annotation", CreateAnnotationInput, AnnotationRead, create_annotation, ("annotations",), 201
    ),
    CommandSpec(
        "update-annotation", UpdateAnnotationInput, AnnotationRead, update_annotation, ("annotations",)
    ),
    CommandSpec(
        "start-market-research",
        MarketResearchInput,
        JobRead,
        start_market_research,
        ("jobs",),
        202,
        async_job="market_research",
    ),
    CommandSpec(
        "set-watchlist",
        SetWatchlistInput,
        WatchlistState,
        set_watchlist,
        ("deals", "watchlist-entries"),
    ),
]
