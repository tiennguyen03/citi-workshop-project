"""User DTOs: request validation and response shapes (api-contract.md › Users)."""

import re
from decimal import Decimal
from typing import Any, Literal

from pydantic import Field, field_validator

from app.core.actor import ROLES
from app.core.dto import RequestModel
from app.core.ids import ID_PATTERN

USERNAME_RE = re.compile(r"^[a-z0-9._-]{3,32}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

Role = Literal["admin", "manager", "employee"]


def _normalise_username(value: str) -> str:
    value = value.strip().lower()
    if not USERNAME_RE.match(value):
        raise ValueError("must be 3-32 characters: lowercase letters, digits, '.', '_' or '-'")
    return value


def _normalise_email(value: str) -> str:
    value = value.strip().lower()
    if not EMAIL_RE.match(value):
        raise ValueError("must be a valid email address")
    return value


class CreateUserRequest(RequestModel):
    username: str
    password: str = Field(min_length=8, max_length=128)
    first_name: str = Field(min_length=1, max_length=60)
    last_name: str = Field(min_length=1, max_length=60)
    email: str
    job_title: str = Field(min_length=1, max_length=80)
    salary: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    role: Role
    manager_id: str | None = Field(default=None, pattern=f"^{ID_PATTERN}$")

    @field_validator("username")
    @classmethod
    def _username(cls, value: str) -> str:
        return _normalise_username(value)

    @field_validator("email")
    @classmethod
    def _email(cls, value: str) -> str:
        return _normalise_email(value)


class ImportUsersRequest(RequestModel):
    """The text of one CSV file (header row + one user per line) and whether to only check it."""

    csv: str = Field(min_length=1, max_length=1_000_000)
    dry_run: bool = False


class UpdateUserRequest(RequestModel):
    """All optional; `provided()` tells the service which fields the client actually sent."""

    first_name: str | None = Field(default=None, min_length=1, max_length=60)
    last_name: str | None = Field(default=None, min_length=1, max_length=60)
    email: str | None = None
    job_title: str | None = Field(default=None, min_length=1, max_length=80)
    salary: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    role: Role | None = None
    manager_id: str | None = Field(default=None, pattern=f"^{ID_PATTERN}$")
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def _email(cls, value: str | None) -> str | None:
        return None if value is None else _normalise_email(value)

    def provided(self) -> dict[str, Any]:
        """Fields explicitly present in the request (a sent `null` counts as provided)."""
        return self.model_dump(exclude_unset=True)


def user_summary(row: dict[str, Any]) -> dict[str, Any]:
    """Public shape safe for any authenticated viewer. No salary, no username."""
    data = {
        "id": row["id"],
        "firstName": row["first_name"],
        "lastName": row["last_name"],
        "email": row["email"],
        "jobTitle": row["job_title"],
        "role": row["role"],
    }
    if "current_project" in row:
        data["currentProject"] = row["current_project"]
    return data


def user_full(row: dict[str, Any], *, include_salary: bool) -> dict[str, Any]:
    """Full shape for admins, managers (reports) and the user themself."""
    data = {
        **user_summary(row),
        "username": row["username"],
        "managerId": row["manager_id"],
        "isActive": row["is_active"],
        "createdAt": row["created_at"],
    }
    if include_salary:
        data["salary"] = row["salary"]
    return data


def membership_history_item(row: dict[str, Any]) -> dict[str, Any]:
    """MembershipHistory: one project the user has been on, with their own allocation and logged hours."""
    return {
        "id": row["id"],
        "name": row["name"],
        "status": row["status"],
        "archived": row["archived"],
        "hoursAssigned": row["hours_assigned"],
        "hoursCompleted": row["hours_completed"],
        "isActive": row["is_active"],
        "releasedReason": row["released_reason"],
        "addedAt": row["added_at"],
        "releasedAt": row["released_at"],
    }


assert set(Role.__args__) == set(ROLES)  # nosec B101 - import-time consistency check, not input validation
