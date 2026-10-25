from pydantic import BaseModel
from sqlmodel import Session, select

from app.models import Deal, WatchlistEntry
from app.repositories.repository import Repository


class SetWatchlistInput(BaseModel):
    deal_id: str
    on: bool
    note: str | None = None


class WatchlistState(BaseModel):
    deal_id: str
    on: bool
    note: str | None = None

    @property
    def id(self) -> str:
        return self.deal_id


def set_watchlist(data: SetWatchlistInput, session: Session) -> WatchlistState:
    """Put a deal on or take it off the watchlist; repeating a call changes nothing."""
    Repository(Deal, session).get(data.deal_id)
    entry = session.exec(select(WatchlistEntry).where(WatchlistEntry.deal_id == data.deal_id)).first()
    if not data.on:
        if entry:
            session.delete(entry)
        return WatchlistState(deal_id=data.deal_id, on=False)
    if entry is None:
        entry = WatchlistEntry(deal_id=data.deal_id)
    if data.note is not None:
        entry.note = data.note
    session.add(entry)
    return WatchlistState(deal_id=data.deal_id, on=True, note=entry.note or None)
