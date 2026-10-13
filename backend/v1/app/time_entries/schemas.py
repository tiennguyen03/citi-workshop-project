"""Time entry DTOs and response shape (api-contract.md › Time entries)."""

from datetime import date
from decimal import Decimal
from typing import Any

from pydantic import Field

from app.core.dto import RequestModel
from app.users.schemas import user_summary

MIN_HOURS = Decimal("0.25")
MAX_HOURS = Decimal("24")


class CreateTimeEntryRequest(RequestModel):
    entry_date: date
    hours: Decimal = Field(ge=MIN_HOURS, le=MAX_HOURS, max_digits=5, decimal_places=2)
    note: str = Field(default="", max_length=500)


class UpdateTimeEntryRequest(RequestModel):
    entry_date: date | None = None
    hours: Decimal | None = Field(default=None, ge=MIN_HOURS, le=MAX_HOURS, max_digits=5, decimal_places=2)
    note: str | None = Field(default=None, max_length=500)

    def provided(self) -> dict[str, Any]:
        return self.model_dump(exclude_unset=True)


def time_entry_shape(row: dict[str, Any]) -> dict[str, Any]:
    """TimeEntry: `row` is a time_entries row joined with its author's user columns."""
    return {
        "id": row["id"],
        "projectId": row["project_id"],
        "user": user_summary(
            {
                "id": row["user_id"],
                "first_name": row["first_name"],
                "last_name": row["last_name"],
                "email": row["email"],
                "job_title": row["job_title"],
                "role": row["role"],
            }
        ),
        "entryDate": row["entry_date"],
        "hours": row["hours"],
        "note": row["note"],
        "createdAt": row["created_at"],
    }
