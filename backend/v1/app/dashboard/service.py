"""Role-specific landing page data (ui-flow.md › Per-role landing). Read-only; composes other repositories."""

from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from app.core.actor import Actor
from app.dashboard import repository as default_repo
from app.milestones import repository as milestones_repo
from app.projects import repository as projects_repo
from app.projects import service as projects
from app.projects.schemas import STATUS_ACTIVE
from app.time_entries import repository as time_repo
from app.users import repository as users_repo
from app.users.schemas import user_summary


def _week_bounds(today: date) -> tuple[date, date]:
    """Monday..Sunday of the week containing `today`."""
    start = today - timedelta(days=today.weekday())
    return start, start + timedelta(days=6)


def _project_card(row: dict[str, Any], *, include_costs: bool) -> dict[str, Any]:
    row = projects._with_capacity(row)
    card = {
        "id": row["id"],
        "name": row["name"],
        "status": row["status"],
        "archived": row["archived"],
        "startDate": row["start_date"],
        "endDate": row["end_date"],
        "memberCount": row["member_count"],
        "hoursAssigned": row["hours_assigned"],
        "hoursCompleted": row["hours_completed"],
        "capacityHours": row["capacity_hours"],
        "milestoneCounts": {"open": row["milestones_open"], "complete": row["milestones_complete"]},
    }
    if include_costs:
        card.update(
            {
                "budget": row["budget"],
                "costConsumed": row["cost_consumed"],
                "budgetRemaining": row["budget"] - row["cost_consumed"],
            }
        )
    return card


def _attention_reasons(card: dict[str, Any], today: date) -> list[str]:
    reasons = []
    if card["budgetRemaining"] < 0:
        reasons.append("over_budget")
    if card["status"] == STATUS_ACTIVE and card["endDate"] < today:
        reasons.append("past_end")
    return reasons


# ---- per role --------------------------------------------------------------------


def _admin(today: date, repo) -> dict[str, Any]:
    rows = projects_repo.list_summaries(archived=None, status=None)
    cards = [_project_card(r, include_costs=True) for r in rows]
    live = [c for c in cards if not c["archived"]]
    attention = []
    for card in live:
        reasons = _attention_reasons(card, today)
        if reasons:
            attention.append({**card, "reasons": reasons})
    return {
        "role": "admin",
        "stats": {
            "activeProjects": sum(1 for c in live if c["status"] == STATUS_ACTIVE),
            "completeProjects": sum(1 for c in live if c["status"] != STATUS_ACTIVE),
            "archivedProjects": sum(1 for c in cards if c["archived"]),
            "users": repo.user_counts_by_role(),
            "availableEmployees": repo.available_employee_count(),
        },
        "attention": attention,
    }


def _manager(actor: Actor, today: date, repo) -> dict[str, Any]:
    rows = projects_repo.list_summaries(archived=False, status=None, manager_id=actor.id)
    cards = [{**_project_card(r, include_costs=True)} for r in rows]
    for card in cards:
        card["reasons"] = _attention_reasons(card, today)
    reports = users_repo.list_reports(actor.id, active_only=True)
    current = users_repo.current_projects([r["id"] for r in reports])
    week_start, week_end = _week_bounds(today)
    hours = time_repo.hours_in_range([r["id"] for r in reports], week_start, week_end)
    team = [
        {
            "user": user_summary(r),
            "currentProject": current.get(r["id"]),
            "hoursThisWeek": hours.get(r["id"], Decimal(0)),
        }
        for r in reports
    ]
    return {"role": "manager", "projects": cards, "team": team, "week": {"start": week_start, "end": week_end}}


def _employee(actor: Actor, today: date, repo) -> dict[str, Any]:
    rows = projects_repo.list_summaries(archived=False, status=None, member_user_id=actor.id)
    cards = [_project_card(r, include_costs=False) for r in rows]
    active = projects_repo.active_membership(actor.id)
    current = None
    if active:
        card = next(c for c in cards if c["id"] == active["id"])
        membership = projects_repo.find_member(active["id"], actor.id)
        open_ms = milestones_repo.open_assignments(active["id"], [actor.id])
        current = {
            **card,
            "myHoursAssigned": membership["hours_assigned"],
            "myHoursCompleted": membership["hours_completed"],
            "currentMilestone": (
                {"id": open_ms[0]["milestone_id"], "name": open_ms[0]["milestone_name"]} if open_ms else None
            ),
        }
    week_start, week_end = _week_bounds(today)
    return {
        "role": "employee",
        "currentProject": current,
        "pastProjects": [c for c in cards if not active or c["id"] != active["id"]],
        "openGoals": repo.open_goals_for(actor.id),
        "hoursThisWeek": time_repo.hours_in_range([actor.id], week_start, week_end).get(actor.id, Decimal(0)),
        "week": {"start": week_start, "end": week_end},
    }


def get_dashboard(actor: Actor, repo=default_repo, today: date | None = None) -> dict[str, Any]:
    today = today or date.today()
    if actor.is_admin:
        return _admin(today, repo)
    if actor.is_manager:
        return _manager(actor, today, repo)
    return _employee(actor, today, repo)
