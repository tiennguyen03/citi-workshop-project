"""Login and current-user business rules."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from app.core import security
from app.core.actor import Actor
from app.core.errors import NotFound, Unauthenticated
from app.users import repository as users_repo

BAD_CREDENTIALS = "Invalid username or password"


@dataclass(frozen=True)
class LoginResult:
    token: str
    expires_at: datetime
    user: dict[str, Any]


def login(username: str, password: str, repo=users_repo) -> LoginResult:
    """Verify credentials and issue a token. Same error for unknown user and wrong password."""
    row = repo.find_credentials(username.strip().lower())
    if row is None or not security.verify_password(password, row["password_hash"]):
        raise Unauthenticated(BAD_CREDENTIALS)
    if not row["is_active"]:
        raise Unauthenticated("This account has been deactivated")
    token, expires_at = security.issue_token(row["id"], row["role"])
    user = {k: v for k, v in row.items() if k != "password_hash"}
    return LoginResult(token=token, expires_at=expires_at, user=user)


def current_user(actor: Actor, repo=users_repo) -> dict[str, Any]:
    """Load the full row for the authenticated actor."""
    row = repo.find_by_id(actor.id)
    if row is None:  # pragma: no cover - middleware already verified existence
        raise NotFound("User not found")
    return row
