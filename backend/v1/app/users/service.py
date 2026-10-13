"""User business rules (requirements M1–M3, security.md role matrix)."""

from typing import Any

from app.core import permissions, security
from app.core.actor import ROLE_ADMIN, ROLE_EMPLOYEE, ROLE_MANAGER, Actor
from app.core.errors import Conflict, Forbidden, NotFound, ValidationError
from app.core.ids import new_id
from app.users import repository as default_repo
from app.users.schemas import CreateUserRequest, UpdateUserRequest, user_full, user_summary

ID_COLLISION_RETRIES = 5


def _with_current_project(rows: list[dict[str, Any]], repo) -> list[dict[str, Any]]:
    projects = repo.current_projects([r["id"] for r in rows])
    return [{**r, "current_project": projects.get(r["id"])} for r in rows]


def _present(actor: Actor, row: dict[str, Any]) -> dict[str, Any]:
    return user_full(row, include_salary=permissions.can_view_salary(actor, row))


def list_users(actor: Actor, *, role: str | None = None, manager_id: str | None = None, repo=default_repo):
    """Admin: everyone (filterable). Manager: own reports + self. Employee: forbidden (use /team)."""
    if actor.is_employee:
        raise Forbidden("Employees can only view their team")
    if actor.is_admin:
        rows = repo.list_users(role=role, manager_id=manager_id)
    else:
        rows = repo.list_reports(actor.id)
        me = repo.find_by_id(actor.id)
        if me:
            rows = [me, *rows]
        if role:
            rows = [r for r in rows if r["role"] == role]
        if manager_id:
            rows = [r for r in rows if r["manager_id"] == manager_id]
    return [_present(actor, r) for r in _with_current_project(rows, repo)]


def get_user(actor: Actor, user_id: str, repo=default_repo) -> dict[str, Any]:
    row = repo.find_by_id(user_id)
    if row is None:
        raise NotFound("User not found")
    permissions.assert_can_view_user(actor, row)
    (row,) = _with_current_project([row], repo)
    return _present(actor, row)


def _validate_manager_assignment(role: str, manager_id: str | None, repo) -> None:
    """Employees need an active manager; managers/admins must not have one."""
    if role == ROLE_EMPLOYEE:
        if not manager_id:
            raise ValidationError("Employees must be assigned to a manager", field="managerId")
        manager = repo.find_by_id(manager_id)
        if manager is None or manager["role"] != ROLE_MANAGER or not manager["is_active"]:
            raise ValidationError("managerId must reference an active manager", field="managerId")
    elif manager_id:
        raise ValidationError("Only employees can have a manager", field="managerId")


def create_user(actor: Actor, dto: CreateUserRequest, repo=default_repo) -> dict[str, Any]:
    permissions.assert_admin(actor)
    _validate_manager_assignment(dto.role, dto.manager_id, repo)
    if repo.username_exists(dto.username):
        raise Conflict("Username is already taken", {"field": "username"})
    if repo.email_exists(dto.email):
        raise Conflict("Email is already in use", {"field": "email"})

    row = {
        "username": dto.username,
        "password_hash": security.hash_password(dto.password),
        "first_name": dto.first_name,
        "last_name": dto.last_name,
        "email": dto.email,
        "job_title": dto.job_title,
        "salary": dto.salary,
        "role": dto.role,
        "manager_id": dto.manager_id,
    }
    for _ in range(ID_COLLISION_RETRIES):
        candidate = new_id()
        if repo.find_by_id(candidate) is None:
            created = repo.insert({**row, "id": candidate})
            return user_full(created, include_salary=True)
    raise Conflict("Could not allocate a unique user ID, please retry")  # pragma: no cover


def _check_admin_invariants(actor: Actor, target: dict[str, Any], fields: dict[str, Any], repo) -> None:
    new_role = fields.get("role", target["role"])
    deactivating = fields.get("is_active") is False

    if target["role"] == ROLE_MANAGER and new_role != ROLE_MANAGER:
        if repo.count_managed_projects(target["id"]) > 0:
            raise Conflict("Reassign this manager's projects before changing their role")
        if repo.count_reports(target["id"]) > 0:
            raise Conflict("Reassign this manager's employees before changing their role")
    if (
        target["role"] == ROLE_MANAGER
        and deactivating
        and (repo.count_managed_projects(target["id"]) > 0 or repo.count_reports(target["id"]) > 0)
    ):
        raise Conflict("Reassign this manager's projects and employees before deactivating them")

    if deactivating and target["id"] == actor.id:
        raise Conflict("You cannot deactivate your own account")
    if target["role"] == ROLE_ADMIN and (new_role != ROLE_ADMIN or deactivating):
        if repo.count_active_admins() <= 1:
            raise Conflict("There must always be at least one active admin")


def update_user(actor: Actor, user_id: str, dto: UpdateUserRequest, repo=default_repo) -> dict[str, Any]:
    target = repo.find_by_id(user_id)
    if target is None:
        raise NotFound("User not found")
    fields = dto.provided()
    if not fields:
        raise ValidationError("No fields to update")
    permissions.assert_can_edit_user_fields(actor, target, fields.keys())

    if "email" in fields and repo.email_exists(fields["email"], exclude_id=user_id):
        raise Conflict("Email is already in use", {"field": "email"})

    if fields.keys() & permissions.ADMIN_ONLY_USER_FIELDS:
        _check_admin_invariants(actor, target, fields, repo)
        new_role = fields.get("role", target["role"])
        if "role" in fields or "manager_id" in fields:
            manager_id = fields.get("manager_id", target["manager_id"])
            if new_role != ROLE_EMPLOYEE:
                manager_id = fields["manager_id"] if "manager_id" in fields else None
            _validate_manager_assignment(new_role, manager_id, repo)
            fields["manager_id"] = manager_id

    updated = repo.update(user_id, fields)
    (updated,) = _with_current_project([updated], repo)
    return _present(actor, updated)


def get_team(actor: Actor, user_id: str, repo=default_repo) -> dict[str, Any]:
    """The immediate team around `user_id`: its manager and that manager's active employees."""
    if not actor.is_admin and user_id != actor.id:
        raise Forbidden("You can only view your own team")
    user = repo.find_by_id(user_id)
    if user is None:
        raise NotFound("User not found")

    if user["role"] == ROLE_MANAGER:
        manager = user
    elif user["role"] == ROLE_EMPLOYEE:
        manager = repo.find_by_id(user["manager_id"]) if user["manager_id"] else None
    else:
        raise ValidationError("Admins are not part of a team")
    if manager is None:  # pragma: no cover - schema guarantees employees have a manager
        raise NotFound("Manager not found")

    members = _with_current_project(repo.list_reports(manager["id"], active_only=True), repo)
    return {"manager": user_summary(manager), "members": [user_summary(m) for m in members]}
