from typing import Literal

from pydantic import BaseModel, Field
from sqlmodel import Session

from app.models import Annotation
from app.repositories.repository import Repository


class Rect(BaseModel):
    x: float
    y: float
    w: float
    h: float


class Viewport(BaseModel):
    w: int
    h: int


class CreateAnnotationInput(BaseModel):
    route: str
    selector: str
    note: str = Field(min_length=1)
    rect: Rect | None = None
    viewport: Viewport
    theme: str


class UpdateAnnotationInput(BaseModel):
    id: str
    status: Literal["open", "resolved"]


def create_annotation(data: CreateAnnotationInput, session: Session) -> Annotation:
    rect = data.rect
    annotation = Annotation(
        route=data.route,
        selector=data.selector,
        note=data.note,
        rect_x=rect.x if rect else None,
        rect_y=rect.y if rect else None,
        rect_w=rect.w if rect else None,
        rect_h=rect.h if rect else None,
        viewport_w=data.viewport.w,
        viewport_h=data.viewport.h,
        theme=data.theme,
    )
    session.add(annotation)
    return annotation


def update_annotation(data: UpdateAnnotationInput, session: Session) -> Annotation:
    annotation = Repository(Annotation, session).get(data.id)
    annotation.status = data.status
    session.add(annotation)
    return annotation
