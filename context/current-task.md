# Current Task

> Only one feature is "current" at a time. Update this file when starting, progressing or finishing.

## Status: ✅ Slice 13 (pagination) built and deployed to AWS 2026-10-14 (`slice-13-pagination`)

## Plan (3 days) — each item is a thin vertical slice

| # | Slice | Day | Status |
|---|---|---|---|
| 0 | Scaffold `backend/v1` (router + audit hook, http, db, schema, errors, permissions, health) and `frontend` shell (AppShell, routes, client.js, AuthProvider, LoginPage); proxy D7 line; Vite demo removed | 1 AM | **done** |
| 1 | Auth: `POST /auth/login` (audited), `GET /auth/me`, middleware, LoginPage, route guards | 1 AM | **done** |
| 2 | Users: CRUD per contract, permissions, UsersPage, UserDetailPage, ProfilePage, TeamPage; `GET /audit-log` + AuditLogPage (admin) so every later slice is verifiable in the log | 1 PM | **done** |
| 3 | Projects: CRUD, archive/unarchive, members + hours, capacity/stats, ProjectsPage, ProjectFormPage, ProjectDetailPage (Overview + Members tabs) | 2 AM | **done** |
| 4 | Milestones & goals: endpoints, Milestones tab, MilestoneDetailPage, goal toggling, project complete | 2 PM | **done** |
| 5 | Time entries: endpoints, Time tab, dashboard per role (~~seed data~~ done early) | 3 AM | **done** |
| 6 | Hardening: tests to target, responsive pass, README, deploy to AWS, smoke test, known gaps | 3 PM | **deployed 2026-10-14** (README location still open) |
| 7 | UX signals (frontend only): overdue / due-soon / past-end tags, 40 h week bar, clickable dashboard counts, `?tab=` deep links, search + filters on Projects/Users mirrored in the URL, milestone ordering with "Next due", capacity hint when assigning hours, this-week / last-week filter on the Time tab | pre-demo | **done** |
| 8 | Dashboards: manager "Due soon" + current milestone per report + zero-hour cue; admin recent activity + wider attention reasons; employee teammates + recent entries (`GET /dashboard` grows) | pre-demo | **done** |
| 9 | People & audit: user page "Reports to" + project history; audit log action/actor pickers (`GET /users/{id}` grows, `GET /audit-log/actions`) | pre-demo | **done** |
| 10 | Visual identity (D20): serif display face for titles and figures, self-hosted fonts, sentence-case labels, no middle-dot strings, tile/section/table hierarchy, ink neutrals, two-part login, two copy fixes | pre-demo | **done** |
| 11 | Polish from a role-by-role walkthrough: goal-assignee hint, "not your project" message, one people page per role, Manager column for admins, non-assignee hint on milestones, milestone start defaults to today, empty hours on add member, project name in Log time, fixed back links, readable audit actions; "who is on what" moved to the Members tab; New project is a dialog; icons; role as a fact | pre-demo | **done** |
| 12 | Admin dashboard rebuilt around project health (D21): pillar tiles, health board worst-first, recent activity; manager cards get the health word and a team weekly total; seed keeps one finished unarchived project | pre-demo | **done** |
| 13 | Server-side paging and search (D23): `limit`/`offset`/`q` on users, projects and time entries, `Page<T>` shape, Users subtitle from an API `summary`; `DataTable` paging footer with the page in the URL, debounced search, audit log loses "Load more" | pre-demo | **done** |

## Current slice: 13 — Pagination (agreed 2026-10-14: server-side, user said "go")

**Done**: `core/paging.py` (`parse_page`, `page`, 25/100), users/projects/time-entries repositories count + page in
SQL with `q` search, users `summary` counts, audit log on the shared parser; contract `Page<T>`; `DataTable`
`pagination` prop (MUI `TablePagination`), `useDebouncedValue`, Users/Projects/Time tab/Audit log paged with
`page` in the URL, `listFilters.js` removed; tests updated, `e2e/lists.spec.js` added; docs D18/D23/ui-flow.
133 backend tests (97 %), 93 frontend, 13 e2e; screenshot pass with 144 users / 333 audit rows, no console errors.
**Remaining**: nothing; hosted site redeployed (backend + frontend) and smoke-tested.
**Blockers**: none.

## Slice 11 — Polish (done 2026-10-14)

**Done**: all ten applied (frontend only); `utils/auditActions.js` names every audit code in plain words (AuditLogPage, admin
dashboard); `defaultMilestoneStart` in `utils/milestoneForm.js`; nav has one people entry per role; 92 frontend tests
(+3), ESLint clean.
**Remaining**: e2e, screenshot pass, commit + push on request.
**Blockers**: none.

## Slice 10 — Visual identity (done 2026-10-14)

**Acceptance**: D20 holds on every screen; no external font request; 89 frontend tests, 12 e2e, walk clean at 390/1360 light/dark.
**Done**: fonts self-hosted; theme (display face, sentence-case overline + table head, ink neutrals); StatCard as a tile;
login rebuilt; 17 middle-dot strings rewritten; two fallback error strings and the dashboard subtitle replaced;
tests and e2e strings updated; 28-screen walk clean; 12 e2e green.
**Remaining**: commit + push on request.
**Blockers**: none.

## Slice 9 — People & audit (done 2026-10-14)

**Acceptance**: a person's page shows who they report to (link) and every project they have been on with hours,
membership state and dates (archived ones only for admins); admins can jump from there to the audit log filtered to
that person; the audit log's Action box is a dropdown of real action names and there is an Actor dropdown; both live
in the URL. New read route `GET /audit-log/actions`; `GET /users/{id}` gains `manager` + `projects`.
**Done**: contract; `users.repository.membership_history`, `membership_history_item`, `get_user` additions, `core.audit.ACTIONS`
(unit test keeps it equal to the route table), `GET /audit-log/actions`; unit + integration tests; frontend user page + audit
page with `useUrlFilters`; new `UserDetailPage.test.jsx`, audit page tests (deep link, clear, error); e2e auth spec updated.
111 backend tests (97 %), 89 frontend, 12 e2e, ruff/Bandit/ESLint clean; browser walk of the user page and audit log.
**Remaining**: commit + push on request.
**Blockers**: none.

## Slice 8 — Dashboards (done 2026-10-14)

**Acceptance**: manager sees every open milestone overdue or due within 7 days across their projects, each report's
current milestone, and a "0 h" nudge for anyone on a project with nothing logged this week; admin sees the last 8
audit entries and attention reasons widen to overdue milestone / no members / no milestones; employee sees the
milestone due date, urgency cue and teammates, plus their last 5 entries with in-place edit. One call: `GET /dashboard`.
**Done**: contract; backend (`next_due_date` in the project summary, `open_assignments_for_users`, `due_soon_milestones`,
`list_entries(limit=)`, `audit_log.service.entry_shape`, wider `_attention_reasons`); unit test for the reasons matrix;
integration test grown (second milestone + empty project); 107 backend tests (97 %); three dashboards extended; 83 frontend
tests; ESLint/ruff/Bandit clean.
12 e2e green (manager "Due soon" row + team milestone link; employee teammates + recent-entry edit from the dashboard;
admin recent activity + "View all"); browser walk of the dashboards.
**Remaining**: commit + push on request.
**Blockers**: none.

## Slice 7 — UX signals (done 2026-10-14; plan: `~/.claude/plans/shiny-singing-simon.md`)

**Acceptance**: every role sees overdue / due-soon cues wherever a due date is shown; employee week reads "x of 40 h";
admin "Available" and manager "N members / open milestones" are links; Projects and Users have search + filters
that survive in the URL; milestones list open-first by due date with a "Next due" marker; assigning hours shows
project capacity so far and warns (not blocks) past it; Time tab filters this/last week. No API change (D19).
**Done**: `utils/dates.js`, `DueTag`, `ListToolbar`, `useUrlFilters`, `listFilters`, `milestones` helpers (+ unit tests);
StatCard `to`/`footer`, ProgressBar `color`; all pages wired; 83 frontend tests, ESLint clean; 12 e2e green
(3 new assertions in `time-dashboards.spec.js`); 92-screen walk (3 roles × 23 pages × 1360/390 px × light/dark) with
no overflow and no console errors; D19 written; CLAUDE.md notes. Seed tweak so the demo shows the cues: "Account &
billing pages" (Customer Portal) is now open past its due date → **Overdue**; "Schema mapping" (Data Warehouse) is due
2026-10-17 → **Due in N days**.
**Remaining**: commit + push on request.
**Blockers**: none.

## Slice 6 leftovers (need a decision)
- Project README → where it lives (root README is boilerplate).
- Deploy to AWS + Lambda memory check + smoke test → user said "not yet".

## Watch list
- E2E flake: `auth.spec.js › admin deactivates a user…` timed out (45 s) twice, each time on the first full run right after
  the stack was disturbed (Vite re-optimising after edits, or a Lambda hot reload after a reseed); it passed on every rerun,
  on three consecutive full runs, and when the hot reload was forced deliberately. Not reproduced on demand; if it returns,
  keep the `trace.zip` from `node_modules/.cache/e2e-results` before rerunning.
- LocalStack reports `Max Memory Used: 128 MB` for the Lambda (pydantic + psycopg at cold start). May be LocalStack's reporting quirk, but verify real memory on the first AWS deploy (slice 6); if tight, drop pydantic for hand-written validators (D3 fallback).
- `start-dev.sh` vendors Python deps with the PATH `pip` (Python 3.14) → silently fails for the 3.13 Lambda. Workaround documented in `CLAUDE.md`; re-run the venv vendoring whenever `requirements.txt` changes.

## Open questions
None. Resolved 2026-10-14 (all confirmed as assumed): Q1 every project must have a manager ·
Q2 managers staff from their own direct reports, admins from anyone · Q3 `hours_assigned` set
by the manager · Q4 employees see their own salary on the profile page · Q5 budget is currency ·
Q6 admin sets a temporary password · Q7 project completion blocked while any milestone is open
(milestone completion with open goals only warns) · Q8 managers may manage several projects.

## Done log
- 2026-10-14 · **Slice 13 built** (branch `slice-13-pagination`, D23). Users, projects and time entries page on the server (`limit` ≤ 100, `offset`, `q` search in SQL, `Page<T>` shape, admin `summary` counts); the audit log shares the parser. `DataTable` gained a paging footer, the page number sits in the URL with the filters, search is debounced, "Load more" is gone, `utils/listFilters.js` deleted. 133 backend tests (97 %), 93 frontend, 13 e2e.
- 2026-10-14 · **Slice 12 built** (branch `slice-12-dashboard`, D21). Admin dashboard is three pillar tiles (hours, budget, people) over a project health board sorted worst first (late, at risk, needs setup, done-not-archived, on track) plus recent activity; manager cards carry the health word and a team weekly total; seed leaves Legacy VPN complete and unarchived so there is something to close. 113 backend tests (97 %), 96 frontend, 12 e2e.
- 2026-10-14 · **Deployed to AWS** (on `slice-12-dashboard`). `./bin/deploy-backend.sh aws` then `./bin/deploy-frontend.sh aws`, no manual steps beyond the workshop scripts. Site: https://d2f2rff70xkxny.cloudfront.net (CloudFront → S3 for the app, `/api/v1*` → the Lambda function URL). Lambda `coding-workshop-v1-ae7479c0` in us-east-2, 96 MB of 128 MB at cold start. Schema init + demo seed ran on the first request against Aurora (`codingworkshop` db). First requests after the 5-minute Aurora auto-pause failed with 502 (10 s connect timeout): cloud timeout raised to 45 s with one retry (`core/db.py`, unit-tested), redeployed. Known: the page title is the boilerplate's "hello-world" (`frontend/index.html` is read-only).
- 2026-10-14 · **Icons and the role label** (on `slice-11-polish`). Following the MUI icon guidance (Outlined theme, decorative icons stay aria-hidden, muted colour, 20 px): `StatCard` takes an `icon` shown opposite the label; new `components/SectionHeading` (icon + title + aside) replaces the hand-rolled heading rows on the three dashboards; project tabs carry icons; the dashboard empty states get a green check. The role chip left the page-header button row on the user page and the profile; "Role" is now the first fact in the details panel. 93 frontend tests.
- 2026-10-14 · **New project is a dialog** (on `slice-11-polish`). The only form in the app that lived on its own page (`/projects/new`, `ProjectFormPage`) is gone; `pages/ProjectsPage/ProjectDialog.jsx` handles create and edit (it replaces `ProjectEditDialog`), opened from "New project" on the Projects page and on the admin dashboard, landing on the new project afterwards. Tests moved; e2e creates from the dashboard button.
- 2026-10-14 · **"Who is on what" moved** (on `slice-11-polish`). The tag box under the milestones table is gone. `GET /projects/{id}/members` now carries `currentMilestone: {id, name}|null` per member (from `milestones.repository.open_assignments`), shown as a "Current milestone" column on the Members tab, with "Free" for an active member on no open milestone. The Milestones tab shows a single sentence, "Free for a new milestone: …", only when the project is writable and someone is free. Integration test added; e2e milestone spec follows the move. 112 backend tests (97 %), 92 frontend, 12 e2e.
- 2026-10-14 · **Slice 11 built** (branch `slice-11-polish`). From a scripted walkthrough of 31 screens as admin, manager and employee: (1) empty goal-assignee picker explains that assignees are set with Edit; (2) a manager opening a project they don't manage sees why, with an "All projects" button instead of Retry; (3) managers get one "My team" nav entry (the searchable users page) instead of "My team" + "Users"; (4) admin user list gains a Manager column; (5) a non-assignee on a milestone is told why goals are disabled; (6) new milestones start today (clamped to the project); (7) Add member starts with empty hours instead of 0; (8) the Log time dialog names the project; (9) the user page's back link is a fixed destination per role; (10) audit actions read as sentences with the code beneath. 92 frontend tests, 12 e2e.
- 2026-10-14 · **Slice 10 built** (branch `slice-10-identity`, D20). Evaluation against the `frontend-design` skill → all seven recommendations applied: IBM Plex Serif for titles and headline figures (Inter for the rest), both self-hosted from `src/assets/fonts`; overline + table-header tokens to sentence case; neutrals shifted to a blue-black ink and a navy dark ground; `StatCard` is a flat tile on a tinted ground (sections and tables keep borders); login is a two-part screen with the three pillars set as type; 17 " · " strings rewritten as sentences or stacked lines; "Something went wrong" → a specific message; dashboard subtitle is the date. 89 frontend tests, 12 e2e, 28-screen walk clean.
- 2026-10-14 · **Slice 9 built** (branch `slice-9-people-audit`). `GET /users/{id}` gains `manager {id, firstName, lastName}|null` and `projects: MembershipHistory[]` (every project the person has been on, with their own assigned/logged hours, membership state, joined/released dates; archived ones only for admins) via `users.repository.membership_history`. New `GET /audit-log/actions` backed by `core.audit.ACTIONS`, which `tests/unit/test_routes.py` keeps equal to the route table. Frontend: user page shows "Reports to" (link), a Projects history table and, for admins, "View activity" → `/audit-log?actorId=…`; the audit log's Action and Actor are dropdowns and all its filters live in the URL (`useUrlFilters` gained `setFilters` for multi-key updates — React Router's functional `setSearchParams` reads the current render's params, so sequential single-key calls clobber each other). New `UserDetailPage.test.jsx`; audit page tests cover deep link, clear and error. 111 backend tests (97 %), 89 frontend, 12 e2e.
- 2026-10-14 · **Slice 8 built** (branch `slice-8-dashboards`). `GET /dashboard` grows: `ProjectCard.nextDueDate`; admin `recentActivity` (last 8 audit rows) and attention reasons `overdue_milestone` / `no_members` / `no_milestones`; manager `dueSoon` (open milestones overdue or due ≤ 7 days across their live projects, with assignees) and `team[].currentMilestone`; employee `currentMilestone.{dueDate, assignees}` and `recentEntries` (last 5 own). Backend: one subquery in the project summary, `milestones.open_assignments_for_users`, `dashboard.due_soon_milestones`, `time_entries.list_entries(limit=)`, public `audit_log.service.entry_shape`; `_attention_reasons` unit-tested as a matrix. Frontend: manager "Due soon" table + "Next due" on cards + current-milestone column + "0 h" nudge; admin "Recent activity" with "View all"; employee milestone due date, cue and teammates, "Recent entries" with in-place edit. 107 backend tests (97 %), 83 frontend, 12 e2e.
- 2026-10-14 · **Slice 7 built** (branch `slice-7-signals`, D19). Frontend-only: `DueTag` (Overdue / Due today / Due in N days; "Past end date" on projects) on the project list and header, milestones tab and page, and the employee's goal list; employee "Hours this week" measured against the 40-hour week; admin "Available" count and manager "N members" / "open milestones" are links (`?tab=` deep links on the project page); search + status filter on Projects and search + role + "Available only" + "Show deactivated" on Users, mirrored in the URL; milestones ordered open-first by due date with a "Next due" marker; hours dialog shows project capacity so far and warns (not blocks) past it; Time tab This week / Last week / All. 83 frontend tests (+29), 12 e2e, 92-screen walk clean. Demo seed: one overdue and one due-soon milestone.
- 2026-10-13 · **Browser suite in the repo** (`frontend/e2e/`, `@playwright/test@1.56.1` approved by the user). 12 self-contained tests (each spec builds its own office through the API): auth + lockout + audit filter + password change/reset, project form validation, staffing, archive/unarchive, completion gating, milestone life cycle with the one-open-milestone picker, time logging on dashboard and Time tab, manager/admin dashboards, phone width. `npm run test:e2e`.
- 2026-10-13 · **Password change** (branch `slice-6-hardening`). `POST /auth/change-password` (self; current password required, ≥ 8 chars, must differ) and admin temporary reset via `PATCH /users/{id} {password}`; profile page "Password" card, "Reset password" dialog on the admin's user page. The new test caught the audit sanitiser only stripping a key named exactly `password`, so `currentPassword` would have been stored in plaintext — it now drops any key containing "password" or "secret". 96 backend tests (97%), 54 frontend, 7-step browser walkthrough.
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
