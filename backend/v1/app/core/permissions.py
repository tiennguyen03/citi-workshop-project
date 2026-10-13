"""
Single home for role/ownership rules (security.md). Pure functions over (actor, resource).

Services call these; handlers and repositories never make permission decisions.
`can_*` return bool; `assert_*` raise Forbidden.
"""

from collections.abc import Iterable
from typing import Any

from app.core.actor import Actor
from app.core.errors import Forbidden

# Fields on a user that only an admin may change.
ADMIN_ONLY_USER_FIELDS = frozenset({"job_title", "salary", "role", "manager_id", "is_active", "password"})
# Fields a manager (for reports) or the user themself may change.
SELF_EDITABLE_USER_FIELDS = frozenset({"first_name", "last_name", "email"})


def assert_admin(actor: Actor) -> None:
    if not actor.is_admin:
        raise Forbidden("Only admins can do that")


def manages_project(actor: Actor, project: dict[str, Any]) -> bool:
    """Admin, or the project's manager."""
    return actor.is_admin or project["manager_id"] == actor.id


def assert_manages_project(actor: Actor, project: dict[str, Any]) -> None:
    if not manages_project(actor, project):
        raise Forbidden("Only the project's manager or an admin can do that")


def can_view_project(actor: Actor, project: dict[str, Any], is_member: bool) -> bool:
    """Archived ⇒ admin only. Otherwise admin, manager-of, or any (current or past) member."""
    if project.get("archived"):
        return actor.is_admin
    return actor.is_admin or project["manager_id"] == actor.id or is_member


def can_see_project_costs(actor: Actor, project: dict[str, Any]) -> bool:
    """Budget/cost figures: admin and the project's manager only."""
    return manages_project(actor, project)


def is_direct_report(actor: Actor, user: dict[str, Any]) -> bool:
    return user.get("manager_id") == actor.id


def can_edit_user_fields(actor: Actor, target: dict[str, Any], fields: Iterable[str]) -> bool:
    """Admin: any field. Manager: name/email of direct reports. Anyone: own name/email."""
    requested = set(fields)
    if actor.is_admin:
        return True
    if requested - SELF_EDITABLE_USER_FIELDS:
        return False
    if target["id"] == actor.id:
        return True
    return actor.is_manager and is_direct_report(actor, target)


def assert_can_edit_user_fields(actor: Actor, target: dict[str, Any], fields: Iterable[str]) -> None:
    if not can_edit_user_fields(actor, target, fields):
        raise Forbidden("You cannot edit those fields for this user")


def can_view_salary(actor: Actor, target: dict[str, Any]) -> bool:
    """Admin, the user's manager, or the user themself."""
    return actor.is_admin or target["id"] == actor.id or is_direct_report(actor, target)


def can_view_user(actor: Actor, target: dict[str, Any]) -> bool:
    """Admin: anyone. Manager: self + direct reports. Employee: self, teammates (same manager), own manager."""
    if actor.is_admin or target["id"] == actor.id:
        return True
    if actor.is_manager:
        return is_direct_report(actor, target)
    same_team = actor.manager_id is not None and target.get("manager_id") == actor.manager_id
    return same_team or target["id"] == actor.manager_id


def assert_can_view_user(actor: Actor, target: dict[str, Any]) -> None:
    if not can_view_user(actor, target):
        raise Forbidden("You cannot view this user")


def can_toggle_goal(actor: Actor, goal: dict[str, Any], project: dict[str, Any]) -> bool:
    """Project manager/admin, or the goal's assignee."""
    return manages_project(actor, project) or goal.get("assignee_id") == actor.id


def assert_can_view_audit_log(actor: Actor) -> None:
    if not actor.is_admin:
        raise Forbidden("Only admins can view the audit log")
