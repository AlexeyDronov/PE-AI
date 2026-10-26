from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from app.core import auth
from app.core.auth import Role, User

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginInput(BaseModel):
    username: str
    password: str


class SessionRead(BaseModel):
    token: str
    username: str
    role: Role
    expires_at: datetime


class MeRead(BaseModel):
    username: str
    role: Role
    auth_enabled: bool


@router.post("/login", response_model=SessionRead)
def login(body: LoginInput, request: Request) -> SessionRead:
    settings = request.app.state.settings
    user = auth.login(body.username, body.password, settings)
    token = auth.issue_token(user.username, user.role, settings)
    expires = datetime.fromtimestamp(datetime.now(UTC).timestamp() + auth.SESSION_SECONDS, UTC)
    return SessionRead(token=token, username=user.username, role=user.role, expires_at=expires)


@router.get("/me", response_model=MeRead)
def me(user: Annotated[User, Depends(auth.current_user)], request: Request) -> MeRead:
    enabled = request.app.state.settings.auth_enabled
    return MeRead(username=user.username, role=user.role, auth_enabled=enabled)
