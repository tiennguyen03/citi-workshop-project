# Current Task

> Only one feature is "current" at a time. Update this file when starting, progressing or finishing.

## Status: ⏸ Awaiting approval of `/context` (no implementation code written)

## Plan (3 days) — each item is a thin vertical slice

| # | Slice | Day | Status |
|---|---|---|---|
| 0 | Scaffold `backend/v1` (router + audit hook, http, db, schema, errors, permissions, health) and `frontend` shell (AppShell, routes, client.js, AuthProvider, LoginPage); proxy D7 line; Vite demo removed | 1 AM | **done** |
| 1 | Auth: `POST /auth/login` (audited), `GET /auth/me`, middleware, LoginPage, route guards | 1 AM | **done** |
| 2 | Users: CRUD per contract, permissions, UsersPage, UserDetailPage, ProfilePage, TeamPage; `GET /audit-log` + AuditLogPage (admin) so every later slice is verifiable in the log | 1 PM | **done** |
| 3 | Projects: CRUD, archive/unarchive, members + hours, capacity/stats, ProjectsPage, ProjectFormPage, ProjectDetailPage (Overview + Members tabs) | 2 AM | **done** |
| 4 | Milestones & goals: endpoints, Milestones tab, MilestoneDetailPage, goal toggling, project complete | 2 PM | **done** |
| 5 | Time entries: endpoints, Time tab, dashboard per role (~~seed data~~ done early) | 3 AM | **done** |
| 6 | Hardening: tests to target, responsive pass, README, deploy to AWS, smoke test, known gaps | 3 PM | **in progress** (deploy deferred by user) |

## Current slice: 6 — Hardening (deploy deferred by the user on 2026-10-13)

**Done**: responsive + dark-mode pass (96 screens: every page × 3 roles × 390/1360 px × light/dark; no page overflow, no console errors); known gaps recorded as D18.
**Remaining, each needs a decision**
- Browser E2E suite into the repo (`frontend/e2e/`) → needs `@playwright/test` in `frontend/package.json` (read-only list, D12).
- Project README → where it lives (root README is boilerplate).
- Deploy to AWS + Lambda memory check + smoke test → user said "not yet".
**Progress**: responsive/dark pass ✔ · known gaps ✔
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
- 2026-10-13 · **Slice 6 part 1** (branch `slice-6-hardening`): responsive + dark-mode pass over 96 screens. Fixes: project tabs scroll on narrow screens (the Time tab was unreachable at 390 px); `DataTable` columns can declare `nowrap`, applied to date and name columns (milestone rows were 151 px tall on phones because dates wrapped). Known gaps written as decisions.md D18.
- 2026-10-13 · **Slice 5 done** (branch `slice-5-time-dashboards`). `app/time_entries/` (list scoped to self for members, create for active members only, author-only edit, author/manager/admin delete; hours 0.25–24, date inside project and not in the future; 409 on archived/complete) and `app/dashboard/` (`GET /dashboard`, role-shaped: admin stats + attention list, manager project cards + team with hours this week, employee current project + open goals + hours this week + past projects; added to api-contract). Frontend: Time tab (person filter for managers, edit/delete, stat cards), `TimeEntryDialog`, per-role dashboards (`AdminDashboard`, `ManagerDashboard`, `EmployeeDashboard` with goal ticking and Log time). 94 backend tests (97%), 51 frontend tests, 8-step browser walkthrough green, interactive Playwright MCP pass with PostgreSQL verification.
- 2026-10-13 · **Slice 4 done** (branch `slice-4-milestones`). Ten milestone/goal endpoints in `app/milestones/` (list/create/get/patch, complete/reopen, available-assignees with a `busy` list, goals create/patch/delete); one-open-milestone rule (`MILESTONE_CONFLICT` naming who is busy where, only for newly added assignees on PATCH, re-checked on reopen); dates inside the project; writes `409` on archived/complete projects and on complete milestones; goal assignee must be a milestone assignee; removing an assignee unassigns their goals; `is_open` kept in sync. Frontend: Milestones tab (progress, avatars, "Who is on what"), New/Edit milestone dialog (busy members disabled, conflicts shown on the field), MilestoneDetailPage with goal checklist (optimistic ticks, add/rename/assign/delete, complete with open-goal warning, reopen). 81 backend tests (97%), 43 frontend tests, 8-step browser walkthrough (create → goals → employee ticks → complete → project unlocks → conflict picker → audit → mobile) green.
- 2026-10-13 · **UI refresh + seed IDs** (branch `ui-refresh`, D17). New theme (ink primary, soft `Tag` labels, bordered cards, Inter, light/dark toggle), sidebar shell with user block, redesigned login/dashboard/403/404, `FieldList` for read-only details, `PageHeader` back links, stat grid, tables scroll on mobile. Seed IDs switched from `EMP001`-style to fixed random-style values. 36 frontend tests, 76 backend tests, 13-step browser walkthrough and a 15-screen visual pass (light, dark, mobile) all green.
- 2026-10-14 · **Seed data + deeper browser coverage** (on `slice-3-projects`). `core/seed.py`: 3 managers, 12 employees with real names, 4 projects (one complete+archived), 11 milestones, 20 goals, 22 time entries, 4 employees left available; loads on a fresh DB, disabled in tests, invariants checked by `test_seed.py`. Login page now shows the API's reason on 401 (deactivated vs bad credentials) — found by the browser run. Extended Playwright walkthrough (13 steps) covers: user edit + deactivate → lockout → reactivate, audit filter, archive/unarchive re-claim, completion gating, edit hours, release + re-add member, edit budget, mobile.
- 2026-10-14 · **Slice 3 done.** 13 project endpoints (CRUD, complete, archive/unarchive with member release/re-claim via `released_reason`, members add/update/release with cascade, `available-members`, `stats`); capacity/cost math in `projects/capacity.py` (weekdays × 8 h, salary/2080) with unit tests; one-active-project rule → `PROJECT_CONFLICT`; costs hidden from employees. Frontend: ProjectsPage (archived toggle), ProjectFormPage, ProjectDetailPage with Overview (StatCards + progress) and Members (add dialog fed by available-members, edit hours, release with confirm) tabs; StatCard/ProgressBar/StatusChip/ProjectFields components. 72 backend tests (96%), 36 frontend tests, browser walkthrough admin→manager→employee passes with zero console errors.
- 2026-10-14 · **Slice 2 done.** Users CRUD with role field-whitelist, manager/employee team views, admin invariants (last admin, self-deactivate, demoting managers with reports/projects), `currentProject` on user lists; `GET /audit-log` with filters/paging; reusable `DataTable`/`FormDialog`/`ConfirmDialog`/`NoticeSnackbar`/`UserEditForm`; pages Users, UserDetail, Profile, Team, AuditLog. Repositories use psycopg `sql` composition (Bandit-clean). 64 backend tests (96%), 27 frontend tests. Browser walkthrough (Playwright, scratchpad script) passes 8 screens, zero console errors. Fixed on the way: MUI v9 removed system props on `Stack` (moved to `sx`); sign-out now clears the remembered "from" location so the next user isn't bounced to a forbidden page.
- 2026-10-14 · **Slice 1 done.** `POST /auth/login` + `GET /auth/me`; per-request authenticator reads role/active flag from DB; login success/failure audited with password scrubbed; pydantic DTO base (`core/dto.py`, `extra="forbid"`); users repository/schemas (UserSummary/UserFull). 43 backend tests (95%), 15 frontend tests. Verified live through proxy + LocalStack: login → token → `/auth/me` 200, no token 401, wrong password 401, two audit rows.
- 2026-10-14 · **Slice 0 done.** Backend: 30 tests (unit + integration against local Postgres), 92% coverage, ruff/bandit clean; schema with both partial unique indexes, bootstrap admin, audit hook in router, `/health`. Frontend: ESLint clean, 10 Vitest tests; MUI shell, role-aware nav, auth context, login form. Verified live: `GET /api/v1/health` → 200 via proxy → LocalStack Lambda → Postgres; 404/405 envelopes correct; Lambda logs show method/path/status/actor.
- 2026-10-14 · Q1–Q8 answered by user; requirements/security/ui-flow wording finalised. Context is complete.
- 2026-10-14 · `/context` written (requirements, architecture, data-model, api-contract, security, ui-flow, coding-rules, decisions, current-task).
- 2026-10-14 · M8 changed / D15: one active project per employee; memberships released not deleted — requirements, data-model (partial index, state transitions, seed), api-contract (`PROJECT_CONFLICT`, `available-members`, `includeReleased`), ui-flow, security updated.
- 2026-10-14 · M13a / D14: one open milestone per employee per project — data-model (partial unique index), api-contract (`MILESTONE_CONFLICT`, `available-assignees`), ui-flow, security updated.
- 2026-10-14 · `CLAUDE.md` + D12 (boilerplate read-only). Frontend deps installed with approval (D12 note). MUI MCP server registered. Audit-log requirement added (M19, D13) across requirements, data-model, api-contract, security, architecture, ui-flow.
