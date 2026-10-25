from typing import Literal

from pydantic import BaseModel, field_validator
from sqlmodel import Session

from app.compute.lbo import Overrides
from app.models import Deal, LboScenario
from app.repositories.repository import Repository
from app.schemas import LboScenarioRead


class SaveScenarioInput(BaseModel):
    deal_id: str
    name: str
    case: Literal["base", "down", "up"]
    overrides: Overrides

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, name: str) -> str:
        name = name.strip()
        if not name:
            raise ValueError("name must not be blank")
        return name


def save_scenario(data: SaveScenarioInput, session: Session) -> LboScenarioRead:
    """Store an LBO case and its overrides under a name for a deal."""
    Repository(Deal, session).get(data.deal_id)
    row = LboScenario(
        deal_id=data.deal_id,
        name=data.name,
        assumptions={"case": data.case, "overrides": data.overrides.model_dump(exclude_none=True)},
    )
    session.add(row)
    session.flush()
    return LboScenarioRead.model_validate(row)
