"""
The route table. Every endpoint in api-contract.md is registered here and nowhere else.

Mutating routes MUST declare `audit=` (enforced by tests/unit/test_routes.py).
"""

from app.audit_log import handlers as audit_log
from app.auth import handlers as auth
from app.auth.middleware import authenticate
from app.dashboard import handlers as dashboard
from app.health import handlers as health
from app.milestones import handlers as milestones
from app.projects import handlers as projects
from app.router import Router
from app.time_entries import handlers as time_entries
from app.users import handlers as users


def build_router() -> Router:
    """Assemble the router with the auth middleware and all feature routes."""
    router = Router(authenticator=authenticate)

    router.add("GET", "/health", health.get_health, auth=False)

    # Auth
    router.add(
        "POST",
        "/auth/login",
        auth.post_login,
        auth=False,
        audit="auth.login",
        audit_on_failure="auth.login_failed",
    )
    router.add("GET", "/auth/me", auth.get_me)
    router.add("POST", "/auth/change-password", auth.post_change_password, audit="auth.password_change")

    # Users
    router.add("GET", "/users", users.list_users)
    router.add("POST", "/users", users.create_user, audit="user.create")
    router.add("GET", "/users/{id}", users.get_user)
    router.add("PATCH", "/users/{id}", users.update_user, audit="user.update")
    router.add("GET", "/users/{id}/team", users.get_team)

    # Projects
    router.add("GET", "/projects", projects.list_projects)
    router.add("POST", "/projects", projects.create_project, audit="project.create")
    router.add("GET", "/projects/{id}", projects.get_project)
    router.add("PATCH", "/projects/{id}", projects.update_project, audit="project.update")
    router.add("POST", "/projects/{id}/complete", projects.complete_project, audit="project.complete")
    router.add("POST", "/projects/{id}/archive", projects.archive_project, audit="project.archive")
    router.add("POST", "/projects/{id}/unarchive", projects.unarchive_project, audit="project.unarchive")
    router.add("GET", "/projects/{id}/stats", projects.get_stats)
    router.add("GET", "/projects/{id}/members", projects.list_members)
    router.add("GET", "/projects/{id}/available-members", projects.available_members)
    router.add("POST", "/projects/{id}/members", projects.add_member, audit="project.member_add")
    router.add("PATCH", "/projects/{id}/members/{userId}", projects.update_member, audit="project.member_update")
    router.add("DELETE", "/projects/{id}/members/{userId}", projects.remove_member, audit="project.member_remove")

    # Milestones & goals
    router.add("GET", "/projects/{id}/milestones", milestones.list_milestones)
    router.add("POST", "/projects/{id}/milestones", milestones.create_milestone, audit="milestone.create")
    router.add("GET", "/projects/{id}/available-assignees", milestones.available_assignees)
    router.add("GET", "/milestones/{id}", milestones.get_milestone)
    router.add("PATCH", "/milestones/{id}", milestones.update_milestone, audit="milestone.update")
    router.add("POST", "/milestones/{id}/complete", milestones.complete_milestone, audit="milestone.complete")
    router.add("POST", "/milestones/{id}/reopen", milestones.reopen_milestone, audit="milestone.reopen")
    router.add("POST", "/milestones/{id}/goals", milestones.create_goal, audit="goal.create")
    router.add("PATCH", "/goals/{id}", milestones.update_goal, audit="goal.update")
    router.add("DELETE", "/goals/{id}", milestones.delete_goal, audit="goal.delete")

    # Time entries
    router.add("GET", "/projects/{id}/time-entries", time_entries.list_entries)
    router.add("POST", "/projects/{id}/time-entries", time_entries.create_entry, audit="time_entry.create")
    router.add("PATCH", "/time-entries/{id}", time_entries.update_entry, audit="time_entry.update")
    router.add("DELETE", "/time-entries/{id}", time_entries.delete_entry, audit="time_entry.delete")

    # Dashboard (role-shaped, read-only)
    router.add("GET", "/dashboard", dashboard.get_dashboard)

    # Audit log (admin)
    router.add("GET", "/audit-log", audit_log.list_entries)

    return router
