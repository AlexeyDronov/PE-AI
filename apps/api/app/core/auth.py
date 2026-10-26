"""Two accounts set by the admin (admin, guest) and signed, expiring bearer tokens; guest is view-only."""

import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from typing import Annotated, Literal

from fastapi import Depends, Request

from app.core.config import Settings
from app.core.errors import Forbidden, Unauthorized

Role = Literal["admin", "guest"]
SESSION_SECONDS = 7 * 24 * 3600


@dataclass(frozen=True)
class User:
    username: str
    role: Role


# Who you are when access control is off (local development, tests).
LOCAL = User("local", "admin")


def _accounts(settings: Settings) -> dict[str, tuple[str, Role]]:
    accounts: dict[str, tuple[str, Role]] = {}
    if settings.admin_password:
        accounts[settings.admin_username] = (settings.admin_password, "admin")
    if settings.guest_password:
        accounts[settings.guest_username] = (settings.guest_password, "guest")
    return accounts


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _sign(payload: str, settings: Settings) -> str:
    return _b64(hmac.new((settings.auth_secret or "").encode(), payload.encode(), hashlib.sha256).digest())


def issue_token(username: str, role: Role, settings: Settings) -> str:
    payload = _b64(json.dumps({"u": username, "r": role, "exp": int(time.time()) + SESSION_SECONDS}).encode())
    return f"{payload}.{_sign(payload, settings)}"


def login(username: str, password: str, settings: Settings) -> User:
    """The account for these credentials; raises Unauthorized."""
    account = _accounts(settings).get(username)
    if account is None or not hmac.compare_digest(password.encode(), account[0].encode()):
        raise Unauthorized("Wrong username or password")
    return User(username, account[1])


def authenticate(token: str, settings: Settings) -> User | None:
    """The token's user, if the signature holds, it hasn't expired and the account still exists."""
    payload, _, signature = token.partition(".")
    if not signature or not hmac.compare_digest(signature.encode(), _sign(payload, settings).encode()):
        return None
    try:
        claims = json.loads(_unb64(payload))
    except ValueError:
        return None
    account = _accounts(settings).get(claims.get("u", ""))
    if claims.get("exp", 0) < time.time() or account is None or account[1] != claims.get("r"):
        return None
    return User(claims["u"], claims["r"])


def token_from(authorization: str | None, query_token: str | None) -> str | None:
    """A bearer header, or `?access_token=` for the event stream (EventSource can't send headers)."""
    if authorization and authorization.startswith("Bearer "):
        return authorization.removeprefix("Bearer ")
    return query_token


def current_user(request: Request) -> User:
    """Route dependency: the signed-in user; raises Unauthorized."""
    settings: Settings = request.app.state.settings
    if not settings.auth_enabled:
        return LOCAL
    token = token_from(request.headers.get("authorization"), request.query_params.get("access_token"))
    user = authenticate(token, settings) if token else None
    if user is None:
        raise Unauthorized("Sign in to continue")
    return user


def require_admin(user: Annotated[User, Depends(current_user)]) -> User:
    """Route dependency for anything that changes data or runs a paid agent job."""
    if user.role != "admin":
        raise Forbidden("This account is view-only")
    return user
