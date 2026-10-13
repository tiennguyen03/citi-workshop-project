"""User response shapes (api-contract.md): UserSummary and UserFull."""

from typing import Any


def user_summary(row: dict[str, Any]) -> dict[str, Any]:
    """Public shape safe for any authenticated viewer. No salary, no username."""
    return {
        "id": row["id"],
        "firstName": row["first_name"],
        "lastName": row["last_name"],
        "email": row["email"],
        "jobTitle": row["job_title"],
        "role": row["role"],
    }


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
