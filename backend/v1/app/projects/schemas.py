"""Project DTOs and response shapes (api-contract.md › Projects)."""

from datetime import date
from decimal import Decimal
from typing import Any

from pydantic import Field, model_validator

from app.core.dto import RequestModel
from app.core.ids import ID_PATTERN
from app.users.schemas import user_summary

STATUS_ACTIVE = "active"
STATUS_COMPLETE = "complete"


class CreateProjectRequest(RequestModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=2000)
    budget: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    start_date: date
    end_date: date
    manager_id: str = Field(pattern=f"^{ID_PATTERN}$")

    @model_validator(mode="after")
    def _dates(self):
        if self.end_date < self.start_date:
            raise ValueError("endDate must be on or after startDate")
        return self


class UpdateProjectRequest(RequestModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    budget: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    start_date: date | None = None
    end_date: date | None = None
    manager_id: str | None = Field(default=None, pattern=f"^{ID_PATTERN}$")

    def provided(self) -> dict[str, Any]:
        return self.model_dump(exclude_unset=True)


class AddMemberRequest(RequestModel):
    user_id: str = Field(pattern=f"^{ID_PATTERN}$")
    hours_assigned: Decimal = Field(default=Decimal(0), ge=0, max_digits=7, decimal_places=2)


class UpdateMemberRequest(RequestModel):
    hours_assigned: Decimal = Field(ge=0, max_digits=7, decimal_places=2)


def project_summary(row: dict[str, Any]) -> dict[str, Any]:
    """ProjectSummary: list shape. `row` is a project row joined with its manager and aggregates."""
    return {
        "id": row["id"],
        "name": row["name"],
        "status": row["status"],
        "archived": row["archived"],
        "startDate": row["start_date"],
        "endDate": row["end_date"],
        "manager": user_summary(
            {
                "id": row["manager_id"],
                "first_name": row["manager_first_name"],
                "last_name": row["manager_last_name"],
                "email": row["manager_email"],
                "job_title": row["manager_job_title"],
                "role": "manager",
            }
        ),
        "memberCount": row["member_count"],
        "hoursAssigned": row["hours_assigned"],
        "hoursCompleted": row["hours_completed"],
        "capacityHours": row["capacity_hours"],
        "capacityHoursPerMember": row["capacity_per_member"],
    }


def project_detail(row: dict[str, Any], *, include_costs: bool, membership: dict[str, Any] | None) -> dict[str, Any]:
    data = {
        **project_summary(row),
        "description": row["description"],
        "milestoneCounts": {"open": row["milestones_open"], "complete": row["milestones_complete"]},
        "myMembership": membership,
    }
    if include_costs:
        data.update(
            {
                "budget": row["budget"],
                "costConsumed": row["cost_consumed"],
                "budgetRemaining": row["budget"] - row["cost_consumed"],
            }
        )
    return data


def member_shape(
    row: dict[str, Any],
    *,
    capacity_per_member: Decimal,
    include_costs: bool,
    current_milestone: dict[str, Any] | None = None,
) -> dict[str, Any]:
    data = {
        "user": user_summary(row),
        "hoursAssigned": row["hours_assigned"],
        "hoursCompleted": row["hours_completed"],
        "capacityHours": capacity_per_member,
        "isActive": row["is_active"],
        "addedAt": row["added_at"],
        "releasedAt": row["released_at"],
        "releasedReason": row["released_reason"],
        "currentMilestone": current_milestone,
    }
    if include_costs:
        data["costConsumed"] = row["cost_consumed"]
    return data
