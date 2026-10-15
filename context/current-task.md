# Current Task

> Only one feature is "current" at a time. Update this file when starting, progressing or finishing.

## Status: 🔍 Slice 16 (CSV import of users, D26) built on `slice-16-user-import`; awaiting review before push/deploy. Slices 14–15 pushed and deployed 2026-10-14.

## Plan (3 days) — each item is a thin vertical slice

| # | Slice | Day | Status |
|---|---|---|---|
| 0 | Scaffold `backend/v1` (router + audit hook, http, db, schema, errors, permissions, health) and `frontend` shell (AppShell, routes, client.js, AuthProvider, LoginPage); proxy D7 line; Vite demo removed | 1 AM | **done** |
| 1 | Auth: `POST /auth/login` (audited), `GET /auth/me`, middleware, LoginPage, route guards | 1 AM | **done** |
| 2 | Users: CRUD per contract, permissions, UsersPage, UserDetailPage, ProfilePage, TeamPage; `GET /audit-log` + AuditLogPage (admin) so every later slice is verifiable in the log | 1 PM | **done** |
| 3 | Projects: CRUD, archive/unarchive, members + hours, capacity/stats, ProjectsPage, ProjectFormPage, ProjectDetailPage (Overview + Members tabs) | 2 AM | **done** |
| 4 | Milestones & goals: endpoints, Milestones tab, MilestoneDetailPage, goal toggling, project complete | 2 PM | **done** |
| 5 | Time entries: endpoints, Time tab, dashboard per role (~~seed data~~ done early) | 3 AM | **done** |
| 6 | Hardening: tests to target, responsive pass, README, deploy to AWS, smoke test, known gaps | 3 PM | **done** (README = `PROJECT_TRACKER.md` at the root; pointer line in the boilerplate README approved 2026-10-14) |
| 7 | UX signals (frontend only): overdue / due-soon / past-end tags, 40 h week bar, clickable dashboard counts, `?tab=` deep links, search + filters on Projects/Users mirrored in the URL, milestone ordering with "Next due", capacity hint when assigning hours, this-week / last-week filter on the Time tab | pre-demo | **done** |
| 8 | Dashboards: manager "Due soon" + current milestone per report + zero-hour cue; admin recent activity + wider attention reasons; employee teammates + recent entries (`GET /dashboard` grows) | pre-demo | **done** |
| 9 | People & audit: user page "Reports to" + project history; audit log action/actor pickers (`GET /users/{id}` grows, `GET /audit-log/actions`) | pre-demo | **done** |
| 10 | Visual identity (D20): serif display face for titles and figures, self-hosted fonts, sentence-case labels, no middle-dot strings, tile/section/table hierarchy, ink neutrals, two-part login, two copy fixes | pre-demo | **done** |
| 11 | Polish from a role-by-role walkthrough: goal-assignee hint, "not your project" message, one people page per role, Manager column for admins, non-assignee hint on milestones, milestone start defaults to today, empty hours on add member, project name in Log time, fixed back links, readable audit actions; "who is on what" moved to the Members tab; New project is a dialog; icons; role as a fact | pre-demo | **done** |
| 12 | Admin dashboard rebuilt around project health (D21): pillar tiles, health board worst-first, recent activity; manager cards get the health word and a team weekly total; seed keeps one finished unarchived project | pre-demo | **done** |
| 13 | Server-side paging and search (D23): `limit`/`offset`/`q` on users, projects and time entries, `Page<T>` shape, Users subtitle from an API `summary`; `DataTable` paging footer with the page in the URL, debounced search, audit log loses "Load more" | pre-demo | **done** |
| 16 | CSV import of users (D26): `POST /users/import` with preview (`dryRun`) and all-or-nothing commit, in-file managers, generated passwords shown once, `UserImportDialog` on the Users page | stretch | **built, in review** |
| 15 | Final polish (D25): one status grammar (quiet dot + text for every normal and result state, tinted only for urgency), role contrast through the dot, compact table progress (percentage primary, raw secondary, visible minimum), overview Progress section folded into tiles, paging 10/25/50 with the footer only past one page, icon actions with tooltips, toolbars without a stretched box, structured section summaries, manager-only Projects/My team fixes, employee dashboard recomposed, seed writes a realistic audit trail | pre-demo | **built, in review** |
| 14 | Visual consistency (D24): quiet/tinted tag weights, inline table progress with percentage, stronger StatCard figure, DataTable small + numeric/muted + TitleCell, SectionHeading description, HealthSummary on board and cards, sidebar name wraps | pre-demo | **built, in review** |

## Current slice: 13 — Pagination (agreed 2026-10-14: server-side, user said "go")

**Done**: `core/paging.py` (`parse_page`, `page`, 25/100), users/projects/time-entries repositories count + page in
SQL with `q` search, users `summary` counts, audit log on the shared parser; contract `Page<T>`; `DataTable`
`pagination` prop (MUI `TablePagination`), `useDebouncedValue`, Users/Projects/Time tab/Audit log paged with
`page` in the URL, `listFilters.js` removed; tests updated, `e2e/lists.spec.js` added; docs D18/D23/ui-flow.
133 backend tests (97 %), 93 frontend, 13 e2e; screenshot pass with 144 users / 333 audit rows, no console errors.
**Remaining**: nothing; hosted site redeployed (backend + frontend) and smoke-tested.
**Blockers**: none.

## Slice 16 — CSV import of users (admin), approved and built 2026-10-14

**What**: an admin uploads one CSV and creates many users at once, with a preview that names every problem row
before anything is written. Replaces adding people one at a time. (The audit CSV export idea is dropped.)

**File format**: header row required, columns matched by name (any order, case-insensitive, BOM tolerated):
`username, firstName, lastName, email, jobTitle, salary, role, manager, password`.
- `manager` is the manager's **username** (friendlier than an ID). It may name an existing manager or a manager
  row earlier in the same file, so a whole team can be imported in one go.
- `password` is the temporary password. Left blank, the system generates one and shows it once in the result.
- Limits: 500 rows, 1 MB. Quoted fields and commas inside quotes handled by Python's `csv` module.

**API** (`backend/v1/app/users/`): `POST /users/import` with JSON `{ "csv": "<file text>", "dryRun": true|false }`,
admin only.
- Every row runs the same rules as `POST /users` (`CreateUserRequest`, manager assignment, username/email
  uniqueness) plus uniqueness *within the file*. Errors are collected per row, never thrown on the first.
- `dryRun: true` returns the report and writes nothing. `dryRun: false` is all-or-nothing in one transaction: if
  any row is invalid it returns `400` with the same report and creates nobody, so a partial import can never happen.
- Response: `{ rows: [{ line, username, status: "ok" | "error", errors: [string], generatedPassword?: string }],
  summary: { total, valid, invalid, created } }`.
- Audit: one `user.import` entry, summary "Imported 12 users (10 employees, 2 managers)", details carry the
  usernames (passwords are stripped by the existing sanitiser). Label "Imported users" in `auditActions.js`.

**UI** (`UsersPage`): an "Import CSV" button beside "New user" (admin only) opening a three-step dialog:
1. Choose a `.csv` file (or paste the text) and a "Download template" link (header + two example rows).
2. Preview: a table of every row with a quiet "Ready" or a tinted "Error" tag and the error text; a summary row
   "12 ready, 2 need fixing". Import stays disabled while any row has an error.
3. Import → toast "Created 12 users", the list refetches; rows with a generated password show it once with a
   copy button and a note that it will not be shown again.

**Tests**: backend unit (header missing, unknown column ignored, bad role, unknown manager, employee without
manager, manager with manager, duplicate username in file, in-file manager resolved, blank password generated,
over 500 rows); integration (dry run creates nothing; commit creates all and audits once; second commit → every
row flagged as duplicate, nothing created); frontend dialog test (preview errors, disabled import, success);
one e2e importing three realistically named users then finding them in the list (reseed afterwards).

**Docs**: contract (new endpoint + report shape), decision D26, ui-flow F2 import step, CLAUDE.md audit label.
**Not in scope**: updating existing users from a file, importing projects, Excel files.


## Proposed slice 17 — quality of life (four items picked 2026-10-14), plan for approval

1. **Sortable columns.** `DataTable` columns gain `sortKey`; the header becomes a button with an arrow; the sort lives
   in the URL as `sort=name` / `sort=-name` beside the filters (`useUrlFilters`). Paged lists (Users, Projects,
   Audit log, Time tab) sort on the server: the list endpoints accept `sort` from a per-list allow-list
   (`core/paging.py` `parse_sort`), default unchanged. Small tables (members, milestones, history) sort in memory
   with the same header control. Tests: parser allow-list, one integration per list, DataTable header test.
2. **Copy buttons on IDs and emails.** A shared `components/CopyButton` (icon, tooltip "Copy", toast "Copied") next
   to the ID on the user and project pages and the profile, and next to every email in `FieldList` rows that are
   emails. Clipboard write with a fallback that selects the text. Test: click → clipboard called → toast.
3. **Paste several goals at once.** The "New goal" box on the milestone page becomes a small multi-line field:
   one line = one goal. Type or paste "Rack the hosts\nLabel the cables\nUpdate the CMDB", pick an assignee (or
   none) once, press Add, and three goals appear in the list, each audited as today (`goal.create` per goal). A
   single line keeps working exactly as now. Blank lines are ignored; a line over 200 characters is reported before
   anything is created. Backend: `POST /milestones/{id}/goals` accepts either `{title}` or `{titles: [...]}` in one
   transaction. Tests: service (list, blanks, too long), integration, GoalList test (three lines → three rows).
4. **"Mine only" on the Milestones tab.** A switch (in the URL as `mine=true`) that keeps only milestones the signed-in
   person is assigned to; shown for every role, default off, remembered in the URL like the other filters. Filtering
   is in memory (the tab already holds every milestone of the project). Test: toggle hides the others.

Docs: contract (sort params, goals batch), D28, ui-flow, CLAUDE.md (DataTable `sortKey`, CopyButton). One branch,
reviewed before push. Order: 3, 4, 2, 1 (smallest first; sorting last because it touches four endpoints).

## Slice 15 — Final polish (user brief 2026-10-14; not a redesign; nothing pushed or deployed until approved)

**Acceptance criteria**
1. Equivalent statuses share one grammar: Active/Open/Complete, 200/401, all quiet dot + text with the semantic colour in the
   dot; Overdue, At risk, Available, Archived, Deactivated stay tinted. No legacy pill for a negative result.
2. Role labels read at full text contrast; roles differ by dot colour only (admin purple, manager blue, employee blue-grey).
3. One compact table progress: percentage first (600), raw figures muted beside it, bar under; non-zero progress never
   invisible; goals at 100 % read as success. Applied through `ProgressBar` to the admin board, projects list, members,
   milestones, user history, manager cards.
4. Project Overview has no standalone Progress section; the Hours tiles carry the bar and percentage.
5. Paged lists default to 10 with 10/25/50 options; the footer appears only when total > page size; page and size in
   the URL where the page already keeps filters there; dashboard tables untouched.
6. Every icon-only action has a tooltip, an accessible label and the same hover/focus treatment (`ActionIconButton`).
7. Filter rows are compact groups, not a bordered band across the page; controls share one height.
8. Sidebar: name on up to two lines, role once, full name as a tooltip.
9. Admin: one `ResultCode` treatment (2xx green, 3xx amber, 4xx red, 5xx tinted red); health summary as a structured row
   (count emphasised, label muted, semantic dot) under the section title; board health = tag over muted reason; recent
   activity lighter than the board; demo audit trail shows business events, not only logins.
10. Manager: Projects hides the Manager column and searches by project name; My team lists reports only (self excluded,
    backend); team summary structured under the heading; Time tab labels distinguish the filtered view from the project
    total.
11. Employee: dashboard top is Current project / My progress / This week with structured facts and clear actions; goals
    summary structured; "All my time" is a button; Members tab marks the signed-in person's row with a quiet "You".
12. Profile: salary row hidden for admins (no $0). Milestone detail: shared status/progress, quieter assignee labels.
13. Validation: backend + frontend tests, lint, e2e; screenshot matrix for the listed screens at 1440 and 390, light and
    dark, with no overflow and no console errors; demo data reseeded before the final screenshots.

## Slice 14 — visual consistency pass (approved 2026-10-14 with two constraints: roles/important statuses stay distinguishable; table progress shows percentage + raw figures). Built, not pushed.

Audit over theme.js, StatCard, SectionHeading, DataTable, Tag/RoleChip/StatusChip/DueTag/HealthTag, ProgressBar, PageHeader,
AppShell, and screenshots of admin/manager/employee dashboards, projects list, project detail, users, audit log, login at 1440 px.

**System-level (shared components / theme)**
1. `StatCard`: value size up (h3 scale, ~1.75rem), hint one muted line, and when `footer` is a `ProgressBar` the bar's caption is
   suppressed (today the hint and the bar caption say the same numbers twice). No green values; `color` stays for negatives only.
2. `ProgressBar`: `layout="inline"` for table cells (bar + "53 of 1,560 h" + "3 %" on one line, tabular nums); the
   percentage becomes explicit everywhere a bar sits in a row (projects list, admin board, members, user history, milestones).
3. Tag system: `Tag` gains `variant="quiet"` (dot + text, no fill, no border) for the *normal* state; tinted tags are kept for
   exceptions. `StatusChip` → quiet for active/open; `RoleChip` → quiet in tables; audit action/result → text unless ≥ 400.
   Rule written into CLAUDE.md: "the normal state is text, the exception is a tag".
4. `DataTable`: default `size="small"`; column flags `numeric` (right, tabular) and `muted`; a shared two-line cell
   (`TitleCell`: title 600 + caption) replacing the hand-rolled name/caption stacks in admin board, audit log, milestones.
5. `SectionHeading`: new `description` slot under the title for summaries ("2 at risk, 1 to close, 2 on track"); `aside` is
   for actions only. mb 1.5 → 2.
6. New shared `HealthSummary` (HealthTag + reasons as a muted caption line) used by the admin board and manager cards, so
   health is primary and the reason secondary on both pages.
7. `AppShell` user block: name wraps to two lines (line-clamp 2, full name in `title`), never "System Ad…".

**Page-specific**: admin board rows (project 600 / manager caption via TitleCell, Next due keeps its DueTag, reason tags gone
from the Health cell); admin tiles lose the duplicate captions and the green People value; project overview "Budget remaining"
neutral unless negative; audit log Result column quiet; employee "With …" teammates quiet. Login untouched.

**Expected impact**: every list gets shorter rows and fewer pills; dashboards share one health pattern; no page carries
one-off sx for these concerns. Tests: text queries unchanged, a handful of snapshot-ish assertions (tag presence) updated.

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
- 2026-10-14 · **Slice 16 built** (branch `slice-16-user-import`, D26). `POST /users/import` (admin): header-by-name CSV, every row checked with the `POST /users` rules plus in-file uniqueness, preview with `dryRun` (no write, no audit), all-or-nothing commit in one transaction with managers created before the employees that name them, blank passwords generated and returned once, one `user.import` audit row with usernames only (`Response.audit_details` / `audit_skip` added). `UserImportDialog`: choose or paste, template download, preview table with Ready/Error tags and a summary row, Import enabled only when every row is ready, generated passwords with copy buttons. Tests: 6 unit, 2 integration, dialog test, one e2e. Backend suite at 97 %, 107 frontend tests, 14 e2e.
- 2026-10-14 · **README (N7)** written as `PROJECT_TRACKER.md` at the repo root: walkthrough accounts, architecture picture, backend/frontend layers, run and deploy commands, test commands and counts, enforced rules, trade-offs, known gaps. One approved pointer line in the boilerplate `README.md`. Slices 14 and 15 pushed; hosted API rebuilt with the workshop scripts.
- 2026-10-14 · **Project card refinement** (on `slice-15-final-polish`). The manager's project summary is a shared `components/ProjectCard`: name, one health tag with the reason as muted text beneath (Complete takes the slot on a finished project), progress as one unit ("3% complete", raw hours, full bar via `ProgressBar layout="block"`), and a three-column metric row (Budget remaining, Open milestones, Next due) with the due cue as quiet supporting text (`DueTag variant="quiet"`). Lifecycle `Active` left the card.
- 2026-10-14 · **Slice 15 built** (branch `slice-15-final-polish`, D25; not pushed). One status grammar (quiet dot + text for Active/Open/Complete/200/401; tinted only for urgency), roles at full contrast told apart by the dot, compact table progress (percentage first, raw figures muted, 3 % minimum, green at 100 % for goals), Overview Progress panel folded into the Hours tiles, paging 10/25/50 with the footer only past one page, `ActionIconButton` for every icon action, bare toolbars, `SummaryRow` section summaries, manager Projects without the Manager column, `GET /users` for managers returns reports only, employee dashboard recomposed (Current project / My progress / This week), quiet "You" on the members tab, admin profile without $0, seed writes a dated business audit trail. 103 backend tests (97 %), 103 frontend, 13 e2e; 88-shot matrix clean (1440/390, light/dark).
- 2026-10-14 · **Login composition**: both halves now hug the centre line (statement right-aligned at 560 px, form left-aligned at 440 px), pillars in one grid sized to the widest term, footer line anchored under the pillars, medium inputs with firmer borders and a 2 px focus ring. Identity (split, serif headline, three pillars) unchanged.
- 2026-10-14 · **Manager dashboard**: a manager with one project saw the card at two-thirds width with an empty slot beside it; a lone card now takes the whole row.
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
