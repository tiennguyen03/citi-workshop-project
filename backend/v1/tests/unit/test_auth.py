"""Auth service + middleware with a fake users repository (no database)."""

from datetime import UTC, datetime, timedelta

import pytest

from app.auth import middleware, service
from app.auth.schemas import LoginRequest
from app.core import security
from app.core.dto import parse
from app.core.errors import Unauthenticated, ValidationError
from app.http import Request


class FakeUsersRepo:
    def __init__(self, rows):
        self.rows = {r["id"]: r for r in rows}

    def find_credentials(self, username):
        return next((dict(r) for r in self.rows.values() if r["username"] == username), None)

    def find_by_id(self, user_id):
        row = self.rows.get(user_id)
        return {k: v for k, v in row.items() if k != "password_hash"} if row else None


def make_user(**overrides):
    base = {
        "id": "USR001",
        "username": "jane",
        "password_hash": security.hash_password("Secret123!"),
        "first_name": "Jane",
        "last_name": "Doe",
        "email": "jane@example.com",
        "job_title": "Engineer",
        "salary": 1000,
        "role": "employee",
        "manager_id": "MGR001",
        "is_active": True,
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC),
    }
    return {**base, **overrides}


@pytest.fixture
def repo():
    return FakeUsersRepo([make_user()])


def test_login_success_returns_token_and_user_without_hash(repo):
    result = service.login("  Jane ", "Secret123!", repo=repo)
    assert "password_hash" not in result.user
    assert result.user["id"] == "USR001"
    claims = security.decode_token(result.token)
    assert claims["sub"] == "USR001" and claims["role"] == "employee"
    assert result.expires_at > datetime.now(UTC) + timedelta(hours=7)


@pytest.mark.parametrize("username,password", [("jane", "nope"), ("nobody", "Secret123!")])
def test_login_bad_credentials_same_message(repo, username, password):
    with pytest.raises(Unauthenticated) as exc:
        service.login(username, password, repo=repo)
    assert exc.value.message == service.BAD_CREDENTIALS


def test_login_inactive_user_rejected():
    repo = FakeUsersRepo([make_user(is_active=False)])
    with pytest.raises(Unauthenticated) as exc:
        service.login("jane", "Secret123!", repo=repo)
    assert "deactivated" in exc.value.message


def test_login_request_dto_rejects_extra_and_empty_fields():
    assert parse(LoginRequest, {"username": " jane ", "password": "x"}).username == "jane"
    with pytest.raises(ValidationError) as exc:
        parse(LoginRequest, {"username": "jane", "password": "x", "role": "admin"})
    assert exc.value.details["field"] == "role"
    with pytest.raises(ValidationError) as exc:
        parse(LoginRequest, {"username": "", "password": "x"})
    assert exc.value.details["field"] == "username"


def _request_with(token: str | None) -> Request:
    headers = {"authorization": f"Bearer {token}"} if token else {}
    return Request(method="GET", path="/auth/me", headers=headers)


def test_middleware_returns_actor_from_database_not_token(repo):
    token, _ = security.issue_token("USR001", "admin")  # token claims a role the DB disagrees with
    actor = middleware.authenticate(_request_with(token), repo=repo)
    assert actor.id == "USR001"
    assert actor.role == "employee"
    assert actor.manager_id == "MGR001"


def test_middleware_rejects_missing_bad_expired_and_unknown_tokens(repo):
    with pytest.raises(Unauthenticated):
        middleware.authenticate(_request_with(None), repo=repo)
    with pytest.raises(Unauthenticated):
        middleware.authenticate(_request_with("garbage"), repo=repo)
    expired, _ = security.issue_token("USR001", "employee", now=datetime.now(UTC) - timedelta(days=1))
    with pytest.raises(Unauthenticated):
        middleware.authenticate(_request_with(expired), repo=repo)
    ghost, _ = security.issue_token("NOPE00", "employee")
    with pytest.raises(Unauthenticated):
        middleware.authenticate(_request_with(ghost), repo=repo)


def test_middleware_rejects_deactivated_user():
    repo = FakeUsersRepo([make_user(is_active=False)])
    token, _ = security.issue_token("USR001", "employee")
    with pytest.raises(Unauthenticated):
        middleware.authenticate(_request_with(token), repo=repo)
