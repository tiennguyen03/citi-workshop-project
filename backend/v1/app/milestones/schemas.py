"""Milestone and goal DTOs and response shapes (api-contract.md › Milestones & goals)."""

from datetime import date
from typing import Any

from pydantic import Field, field_validator, model_validator

from app.core.dto import RequestModel
from app.core.ids import ID_PATTERN
from app.users.schemas import user_summary

STATUS_OPEN = "open"
STATUS_COMPLETE = "complete"


def _unique_ids(values: list[str]) -> list[str]:
    seen: list[str] = []
    for value in values:
        if value not in seen:
            seen.append(value)
    return seen


class CreateMilestoneRequest(RequestModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=2000)
    start_date: date
    due_date: date
    assignee_ids: list[str] = Field(default_factory=list, max_length=50)

    @field_validator("assignee_ids")
    @classmethod
    def _ids(cls, value: list[str]) -> list[str]:
        import re

        for item in value:
            if not re.fullmatch(ID_PATTERN, item):
                raise ValueError("each assignee id must be a 6-character ID")
        return _unique_ids(value)

    @model_validator(mode="after")
    def _dates(self):
        if self.due_date < self.start_date:
            raise ValueError("dueDate must be on or after startDate")
        return self


class UpdateMilestoneRequest(RequestModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    start_date: date | None = None
    due_date: date | None = None
    assignee_ids: list[str] | None = Field(default=None, max_length=50)

    _ids = field_validator("assignee_ids")(CreateMilestoneRequest._ids.__func__)  # type: ignore[attr-defined]

    def provided(self) -> dict[str, Any]:
        return self.model_dump(exclude_unset=True)


class CreateGoalRequest(RequestModel):
    title: str = Field(min_length=1, max_length=200)
    assignee_id: str | None = Field(default=None, pattern=f"^{ID_PATTERN}$")


class UpdateGoalRequest(RequestModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    assignee_id: str | None = Field(default=None, pattern=f"^{ID_PATTERN}$")
    is_done: bool | None = None

    def provided(self) -> dict[str, Any]:
        return self.model_dump(exclude_unset=True)


def _prefixed_user(row: dict[str, Any], prefix: str) -> dict[str, Any] | None:
    if row.get(f"{prefix}id") is None:
        return None
    return user_summary(
        {
            "id": row[f"{prefix}id"],
            "first_name": row[f"{prefix}first_name"],
            "last_name": row[f"{prefix}last_name"],
            "email": row[f"{prefix}email"],
            "job_title": row[f"{prefix}job_title"],
            "role": row[f"{prefix}role"],
        }
    )


def goal_shape(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "milestoneId": row["milestone_id"],
        "title": row["title"],
        "assignee": _prefixed_user(row, "assignee_"),
        "isDone": row["is_done"],
        "doneAt": row["done_at"],
    }


def milestone_shape(
    row: dict[str, Any], assignees: list[dict[str, Any]], goals: list[dict[str, Any]]
) -> dict[str, Any]:
    """Milestone with its assignees and goals. `row` carries goals_done/goals_total aggregates."""
    return {
        "id": row["id"],
        "projectId": row["project_id"],
        "name": row["name"],
        "description": row["description"],
        "startDate": row["start_date"],
        "dueDate": row["due_date"],
        "status": row["status"],
        "completedAt": row["completed_at"],
        "sortOrder": row["sort_order"],
        "assignees": [user_summary(a) for a in assignees],
        "goals": [goal_shape(g) for g in goals],
        "goalsDone": row["goals_done"],
        "goalsTotal": row["goals_total"],
    }
