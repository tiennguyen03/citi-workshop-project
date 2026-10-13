# Current Task

> Only one feature is "current" at a time. Update this file when starting, progressing or finishing.

## Status: ⏸ Awaiting approval of `/context` (no implementation code written)

## Plan (3 days) — each item is a thin vertical slice

| # | Slice | Day | Status |
|---|---|---|---|
| 0 | Scaffold `backend/v1` (router + audit hook, http, db, schema, errors, permissions, health) and `frontend` shell (AppShell, routes, client.js, AuthProvider, LoginPage); proxy D7 line; Vite demo removed | 1 AM | **done** |
| 1 | Auth: `POST /auth/login` (audited), `GET /auth/me`, middleware, LoginPage, route guards | 1 AM | **done** |
| 2 | Users: CRUD per contract, permissions, UsersPage, UserDetailPage, ProfilePage, TeamPage; `GET /audit-log` + AuditLogPage (admin) so every later slice is verifiable in the log | 1 PM | todo |
| 3 | Projects: CRUD, archive/unarchive, members + hours, capacity/stats, ProjectsPage, ProjectFormPage, ProjectDetailPage (Overview + Members tabs) | 2 AM | todo |
| 4 | Milestones & goals: endpoints, Milestones tab, MilestoneDetailPage, goal toggling, project complete | 2 PM | todo |
| 5 | Time entries: endpoints, Time tab, dashboard per role, seed data | 3 AM | todo |
| 6 | Hardening: tests to target, responsive pass, README, deploy to AWS, smoke test, known gaps | 3 PM | todo |

## Current slice: 2 — Users (not started; waiting for "go")

**Acceptance criteria**
- Endpoints per api-contract › Users: `GET /users` (role-scoped), `POST /users` (admin; temp password; `managerId` iff employee), `GET /users/{id}`, `PATCH /users/{id}` (field whitelist by role; unknown/forbidden fields → 400), `GET /users/{id}/team`. All mutations audited.
- Invariants: username/email unique (409), employee must have a manager who is a `manager`, cannot demote a manager who still manages projects/users, admin cannot deactivate self / last admin.
- `GET /audit-log` (admin, filters + pagination) and AuditLogPage so later slices are verifiable in the UI.
- Pages: UsersPage (admin: create dialog; manager: own reports), UserDetailPage (role-aware edit form), ProfilePage, TeamPage. Nav links wired.
- Tests: service unit tests with fake repo (permission matrix), integration per endpoint (happy / validation / forbidden), frontend page tests (list, empty, error, form submit).

**Files involved**: `backend/v1/app/users/{handlers,service,schemas,repository}.py`, `app/audit_log/*`, `app/routes.py`; `frontend/src/services/{users,auditLog}.js`, `pages/{UsersPage,UserDetailPage,ProfilePage,TeamPage,AuditLogPage}/`, `components/{DataTable,FormDialog,ConfirmDialog,UserSelect}/`.
**Progress**: —
**Blockers**: none.

## Watch list
- LocalStack reports `Max Memory Used: 128 MB` for the Lambda (pydantic + psycopg at cold start). May be LocalStack's reporting quirk, but verify real memory on the first AWS deploy (slice 6); if tight, drop pydantic for hand-written validators (D3 fallback).
- `start-dev.sh` vendors Python deps with the PATH `pip` (Python 3.14) → silently fails for the 3.13 Lambda. Workaround documented in `CLAUDE.md`; re-run the venv vendoring whenever `requirements.txt` changes.

## Open questions
None. Resolved 2026-10-14 (all confirmed as assumed): Q1 every project must have a manager ·
Q2 managers staff from their own direct reports, admins from anyone · Q3 `hours_assigned` set
by the manager · Q4 employees see their own salary on the profile page · Q5 budget is currency ·
Q6 admin sets a temporary password · Q7 project completion blocked while any milestone is open
(milestone completion with open goals only warns) · Q8 managers may manage several projects.

## Done log
- 2026-10-14 · **Slice 1 done.** `POST /auth/login` + `GET /auth/me`; per-request authenticator reads role/active flag from DB; login success/failure audited with password scrubbed; pydantic DTO base (`core/dto.py`, `extra="forbid"`); users repository/schemas (UserSummary/UserFull). 43 backend tests (95%), 15 frontend tests. Verified live through proxy + LocalStack: login → token → `/auth/me` 200, no token 401, wrong password 401, two audit rows.
- 2026-10-14 · **Slice 0 done.** Backend: 30 tests (unit + integration against local Postgres), 92% coverage, ruff/bandit clean; schema with both partial unique indexes, bootstrap admin, audit hook in router, `/health`. Frontend: ESLint clean, 10 Vitest tests; MUI shell, role-aware nav, auth context, login form. Verified live: `GET /api/v1/health` → 200 via proxy → LocalStack Lambda → Postgres; 404/405 envelopes correct; Lambda logs show method/path/status/actor.
- 2026-10-14 · Q1–Q8 answered by user; requirements/security/ui-flow wording finalised. Context is complete.
- 2026-10-14 · `/context` written (requirements, architecture, data-model, api-contract, security, ui-flow, coding-rules, decisions, current-task).
- 2026-10-14 · M8 changed / D15: one active project per employee; memberships released not deleted — requirements, data-model (partial index, state transitions, seed), api-contract (`PROJECT_CONFLICT`, `available-members`, `includeReleased`), ui-flow, security updated.
- 2026-10-14 · M13a / D14: one open milestone per employee per project — data-model (partial unique index), api-contract (`MILESTONE_CONFLICT`, `available-assignees`), ui-flow, security updated.
- 2026-10-14 · `CLAUDE.md` + D12 (boilerplate read-only). Frontend deps installed with approval (D12 note). MUI MCP server registered. Audit-log requirement added (M19, D13) across requirements, data-model, api-contract, security, architecture, ui-flow.
