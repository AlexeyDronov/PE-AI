import re
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlmodel import Session

from app.compute.lbo import LboRequest, load_context, run_lbo, run_sensitivity
from app.exports.lbo_xlsx import build_lbo_workbook
from app.routers.factory import get_read_session

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

router = APIRouter(prefix="/api/exports", tags=["exports"])


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


@router.post(
    "/lbo",
    response_class=Response,
    responses={200: {"content": {XLSX: {"schema": {"type": "string", "format": "binary"}}}}},
)
def export_lbo(body: LboRequest, session: Annotated[Session, Depends(get_read_session)]) -> Response:
    """LBO model for a deal as an Excel workbook."""
    model = run_lbo(body, session)
    grid = run_sensitivity(body, session)
    company = load_context(session, body.deal_id)[1].company.name
    content = build_lbo_workbook(company, model, grid)
    filename = f"{_slug(company)}-lbo-{body.case}.xlsx"
    return Response(
        content, media_type=XLSX, headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
