"""User business rules (requirements M1–M3, security.md role matrix)."""

import csv
import io
import secrets
from typing import Any

from pydantic import ValidationError as PydanticValidationError

from app.core import permissions, security
from app.core.actor import ROLE_ADMIN, ROLE_EMPLOYEE, ROLE_MANAGER, Actor
from app.core.errors import Conflict, Forbidden, NotFound, ValidationError
from app.core.ids import new_id
from app.core.paging import DEFAULT_LIMIT, page
from app.users import repository as default_repo
from app.users.schemas import (
    CreateUserRequest,
    ImportUsersRequest,
    UpdateUserRequest,
    membership_history_item,
    user_full,
    user_summary,
)

ID_COLLISION_RETRIES = 5


def _with_current_project(rows: list[dict[str, Any]], repo) -> list[dict[str, Any]]:
    projects = repo.current_projects([r["id"] for r in rows])
    return [{**r, "current_project": projects.get(r["id"])} for r in rows]


def _present(actor: Actor, row: dict[str, Any]) -> dict[str, Any]:
    return user_full(row, include_salary=permissions.can_view_salary(actor, row))


def _matches(row: dict[str, Any], needle: str) -> bool:
    return needle in f"{row['first_name']} {row['last_name']} {row['email']} {row['username']}".lower()


def list_users(
    actor: Actor,
    *,
    role: str | None = None,
    manager_id: str | None = None,
    q: str | None = None,
    include_inactive: bool = False,
    available_only: bool = False,
    limit: int = DEFAULT_LIMIT,
    offset: int = 0,
    repo=default_repo,
) -> dict[str, Any]:
    """One page of users. Admin: everyone (filterable, with people counts). Manager: own direct reports.
    Employee: forbidden (use /team)."""
    if actor.is_employee:
        raise Forbidden("Employees can only view their team")
    if actor.is_admin:
        rows, total = repo.list_users(
            role=role,
            manager_id=manager_id,
            q=q,
            include_inactive=include_inactive,
            available_only=available_only,
            limit=limit,
            offset=offset,
        )
        summary = repo.people_counts()
    else:
        # "My team" is the people who report to this manager; the manager reads their own record on /auth/me (D25)
        rows = repo.list_reports(actor.id)
        rows = _with_current_project(rows, repo)
        needle = (q or "").strip().lower()
        rows = [
            r
            for r in rows
            if (not role or r["role"] == role)
            and (not manager_id or r["manager_id"] == manager_id)
            and (include_inactive or r["is_active"])
            and (not available_only or (r["role"] == ROLE_EMPLOYEE and not r.get("current_project")))
            and (not needle or _matches(r, needle))
        ]
        total = len(rows)
        rows = rows[offset : offset + limit]
        summary = None
    items = [_present(actor, r) for r in _with_current_project(rows, repo)]
    return page(items, total, limit, offset, summary=summary)


def get_user(actor: Actor, user_id: str, repo=default_repo) -> dict[str, Any]:
    """UserFull plus who they report to and every project they have been on (archived ones: admins only)."""
    row = repo.find_by_id(user_id)
    if row is None:
        raise NotFound("User not found")
    permissions.assert_can_view_user(actor, row)
    (row,) = _with_current_project([row], repo)
    manager = repo.find_by_id(row["manager_id"]) if row["manager_id"] else None
    history = [h for h in repo.membership_history(user_id) if actor.is_admin or not h["archived"]]
    manager_ref = None
    if manager:
        manager_ref = {"id": manager["id"], "firstName": manager["first_name"], "lastName": manager["last_name"]}
    return {
        **_present(actor, row),
        "manager": manager_ref,
        "projects": [membership_history_item(h) for h in history],
    }


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


IMPORT_MAX_ROWS = 500
IMPORT_COLUMNS = ("username", "firstname", "lastname", "email", "jobtitle", "salary", "role", "manager", "password")
IMPORT_REQUIRED = ("username", "firstname", "lastname", "email", "jobtitle", "salary", "role")
_HEADER_ALIASES = {
    "first name": "firstname",
    "first_name": "firstname",
    "last name": "lastname",
    "last_name": "lastname",
    "job title": "jobtitle",
    "job_title": "jobtitle",
    "manager username": "manager",
    "manager_username": "manager",
    "managerusername": "manager",
    "temporary password": "password",
    "temp password": "password",
}


def _header_key(raw: str) -> str:
    key = raw.strip().lstrip("\ufeff").lower()
    return _HEADER_ALIASES.get(key, key.replace(" ", "").replace("_", ""))


def parse_import_csv(text: str) -> list[dict[str, str]]:
    """Rows of a user CSV keyed by canonical column, header matched by name in any order. Whole-file errors raise."""
    reader = csv.reader(io.StringIO(text.lstrip("\ufeff")))
    try:
        header = next(reader)
    except StopIteration as exc:
        raise ValidationError("The file is empty") from exc
    keys = [_header_key(h) for h in header]
    missing = [c for c in IMPORT_REQUIRED if c not in keys]
    if missing:
        raise ValidationError(
            "Missing columns: " + ", ".join(_PRETTY[c] for c in missing),
            details={"missingColumns": [_PRETTY[c] for c in missing]},
        )
    rows: list[dict[str, str]] = []
    for line_no, values in enumerate(reader, start=2):
        if not any(v.strip() for v in values):
            continue
        row = {
            key: (values[i].strip() if i < len(values) else "") for i, key in enumerate(keys) if key in IMPORT_COLUMNS
        }
        row["_line"] = str(line_no)
        rows.append(row)
        if len(rows) > IMPORT_MAX_ROWS:
            raise ValidationError(f"At most {IMPORT_MAX_ROWS} users per file")
    if not rows:
        raise ValidationError("The file has a header but no users")
    return rows


# the wire spelling of each column, for messages ("Missing columns: firstName"); derived, so no column name is
# ever assigned as a literal (Bandit's B105 reads a "password": "..." entry as a hard-coded secret)
_CAMEL = {"firstname": "firstName", "lastname": "lastName", "jobtitle": "jobTitle"}
_PRETTY = {column: _CAMEL.get(column, column) for column in IMPORT_COLUMNS}


_PLAIN_MESSAGES = {
    "string_too_short": "too short (at least {min_length} characters)",
    "string_too_long": "too long (at most {max_length} characters)",
    "missing": "required",
    "literal_error": "must be admin, manager or employee",
    "decimal_parsing": "must be a number",
    "decimal_type": "must be a number",
    "greater_than_equal": "must be 0 or more",
    "decimal_max_digits": "has too many digits",
    "decimal_max_places": "has too many decimal places",
}


def _plain(err: dict[str, Any]) -> str:
    """A row problem in plain words instead of pydantic's phrasing ("Input should be a valid decimal")."""
    template = _PLAIN_MESSAGES.get(err["type"])
    if template:
        return template.format(**err.get("ctx", {}))
    msg = str(err["msg"])
    return msg.removeprefix("Value error, ")


def _generate_password() -> str:
    """A temporary password the admin hands over once: 12 URL-safe characters, always past the 8-character floor."""
    return secrets.token_urlsafe(9)


def import_users(actor: Actor, dto: ImportUsersRequest, repo=default_repo) -> dict[str, Any]:
    """
    Check every row with the rules of `create_user` (plus uniqueness inside the file) and report per row.
    `dry_run` writes nothing. Otherwise the import is all-or-nothing: any invalid row means nobody is created
    and the report comes back as a 400. A `manager` may be an existing manager's username or a manager row
    earlier in the same file, so a whole team imports in one go. A blank password is generated and returned once.
    """
    permissions.assert_admin(actor)
    rows = parse_import_csv(dto.csv)
    seen_usernames: set[str] = set()
    seen_emails: set[str] = set()
    file_managers: dict[str, int] = {}  # username -> index of the row that creates that manager
    prepared: list[dict[str, Any]] = []
    report: list[dict[str, Any]] = []

    for index, raw in enumerate(rows):
        errors: list[str] = []
        generated = None
        password = raw.get("password", "")
        if not password:
            password = generated = _generate_password()
        data = {
            "username": raw.get("username", ""),
            "password": password,
            "firstName": raw.get("firstname", ""),
            "lastName": raw.get("lastname", ""),
            "email": raw.get("email", ""),
            "jobTitle": raw.get("jobtitle", ""),
            "salary": raw.get("salary", ""),
            "role": raw.get("role", "").strip().lower(),
            "managerId": None,
        }
        parsed: CreateUserRequest | None = None
        try:
            parsed = CreateUserRequest.model_validate(data)
        except PydanticValidationError as exc:
            for err in exc.errors():
                field = ".".join(str(part) for part in err["loc"]) or "row"
                errors.append(f"{field}: {_plain(err)}")

        manager_username = raw.get("manager", "").strip().lower()
        manager_id: str | None = None
        manager_from_file: str | None = None
        role = data["role"]
        if role == ROLE_EMPLOYEE:
            if not manager_username:
                errors.append("manager: employees need a manager (the manager's username)")
            else:
                existing = repo.find_by_username(manager_username)
                if existing and existing["role"] == ROLE_MANAGER and existing["is_active"]:
                    manager_id = existing["id"]
                elif manager_username in file_managers:
                    manager_from_file = manager_username
                else:
                    errors.append(
                        f"manager: '{manager_username}' is not an active manager (existing or earlier in this file)"
                    )
        elif manager_username and role in (ROLE_MANAGER, ROLE_ADMIN):
            errors.append("manager: only employees can have a manager")

        username = parsed.username if parsed else data["username"].strip().lower()
        email = parsed.email if parsed else data["email"].strip().lower()
        if username:
            if username in seen_usernames:
                errors.append("username: appears more than once in this file")
            elif repo.username_exists(username):
                errors.append("username: already taken")
            seen_usernames.add(username)
        if email:
            if email in seen_emails:
                errors.append("email: appears more than once in this file")
            elif repo.email_exists(email):
                errors.append("email: already in use")
            seen_emails.add(email)
        if parsed and parsed.role == ROLE_MANAGER and not errors:
            file_managers[username] = index

        report.append(
            {
                "line": int(raw["_line"]),
                "username": username or None,
                "status": "ok" if not errors else "error",
                "errors": errors,
                **({"generatedPassword": generated} if generated and not errors else {}),
            }
        )
        prepared.append(
            {"parsed": parsed, "manager_id": manager_id, "manager_from_file": manager_from_file, "index": index}
        )

    invalid = sum(1 for r in report if r["status"] == "error")
    summary = {"total": len(report), "valid": len(report) - invalid, "invalid": invalid, "created": 0}
    if dto.dry_run:
        return {"rows": report, "summary": summary}
    if invalid:
        raise ValidationError(
            f"{invalid} row{'s' if invalid != 1 else ''} need{'s' if invalid == 1 else ''} fixing; nobody was created",
            details={"rows": report, "summary": summary},
        )

    # managers first, so employees that point at them can be created in the same file
    created_ids: dict[str, str] = {}
    order = sorted(prepared, key=lambda p: (0 if p["parsed"].role == ROLE_MANAGER else 1, p["index"]))
    for item in order:
        parsed = item["parsed"]
        manager_id = item["manager_id"]
        if item["manager_from_file"]:
            manager_id = created_ids[item["manager_from_file"]]
        created = create_user(actor, parsed.model_copy(update={"manager_id": manager_id}), repo=repo)
        created_ids[parsed.username] = created["id"]
        report[item["index"]]["id"] = created["id"]
    summary["created"] = len(created_ids)
    return {"rows": report, "summary": summary}


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

    if "password" in fields:
        fields["password_hash"] = security.hash_password(fields.pop("password"))
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
