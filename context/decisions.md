# Architectural Decisions

Format: ID · date · decision · why · consequences. Newest at the bottom. Never delete; supersede.

## D1 · 2026-10-14 · Python Lambda + PostgreSQL + React (JS), not Spring Boot + MongoDB
**Decision**: Backend is Python 3.13 Lambda, database is PostgreSQL, frontend React (JSX) with MUI.
**Why**: The workshop's stated preference and grading rubric; the boilerplate provisions Aurora
Postgres by default and DocumentDB only on opt-in; Lambdas are configured with 128 MB memory, in
which Spring Boot cannot reliably start. Three-day budget favours the path with zero infra fights.
**Consequences**: The generic "Spring Boot/Mongo" template wording is superseded by this file.

## D2 · 2026-10-14 · One Lambda (`backend/v1`) as a modular monolith, not one Lambda per entity
**Decision**: A single deployable at `/api/v1` with feature packages inside; internal router.
**Why**: The boilerplate packages each `backend/<folder>` independently, so shared code (db, auth,
permissions, errors) would have to be copied into every folder — the exact spaghetti we're
avoiding. One Lambda also means one cold start, one connection pool, one place for auth
middleware. The rubric rewards "modular by domain", which packages satisfy.
**Consequences**: Folder name `v1` becomes the URL prefix (`/api/v1/...`). Router must strip an
optional `/api/v1` prefix because the path seen by the Lambda differs between the local proxy
and CloudFront. Splitting into more Lambdas later is possible per package.

## D3 · 2026-10-14 · Hand-rolled router + pydantic DTOs, no web framework
**Decision**: No Flask/FastAPI/Mangum. ~60-line router matching `(METHOD, regex)`.
**Why**: Frameworks add cold-start time in 128 MB and hide the event shape; our route table is
~35 entries. Pydantic gives validation and camelCase aliasing cheaply.
**Consequences**: We own path-param parsing and error mapping (tested in `tests/unit/test_router.py`).

## D4 · 2026-10-14 · Schema managed by idempotent DDL on cold start + seed when empty
**Decision**: `core/schema.py` runs `CREATE TABLE IF NOT EXISTS …` once per container; seeds demo
data when `users` is empty.
**Why**: No migration tool in the boilerplate; a separate deploy step would break "runs with the
documented scripts" (N1). Idempotent DDL is safe to run repeatedly.
**Consequences**: Column changes after first deploy need an explicit `ALTER … IF NOT EXISTS` added
to `schema.py` (no drops). Acceptable for 3 days. Seeding is deterministic so tests can rely on it.

## D5 · 2026-10-14 · `JWT_SECRET` via one-line Terraform env-var addition
**Decision**: Add `JWT_SECRET = var.jwt_secret` to `local.env_vars` in `infra/locals.tf` with a
`TF_VAR_jwt_secret`-sourced variable (default empty). Locally the app falls back to a dev secret
when `IS_LOCAL=true`.
**Why**: Terraform is the only thing that sets Lambda env vars; no secrets manager in scope.
**Consequences**: Smallest possible infra touch; documented in README as a required export before
`deploy-backend.sh`. If infra edits turn out to be disallowed, fallback is deriving the secret
from `POSTGRES_PASS` (already secret) — recorded here so the trade-off is explicit.
**Amended 2026-10-14 (D12)**: boilerplate files are read-only without explicit user approval.
Default is now the fallback (derive from `POSTGRES_PASS` + `APP_ID`); the `infra/locals.tf`
edit happens only if the user approves it when slice 1 starts.

## D6 · 2026-10-14 · 6-character public ID is the primary key
**Decision**: `TEXT` PK with `[A-Z0-9]{6}` generated with `secrets`, collision-retried.
**Why**: Requirement asks for a 6-char ID users see; a separate surrogate key adds joins and two
IDs to reason about for no benefit at this scale (~36^6 ≈ 2.2 B values).
**Consequences**: All entities share the scheme for consistency. Validate format at the edge.

## D7 · 2026-10-14 · Patch the local proxy to forward `Authorization`
**Decision**: Add `authorization: headers.authorization` to the forwarded header allowlist in
`bin/proxy-server.js`.
**Why**: The proxy strips all but four headers, so Bearer auth would fail only locally — a
confusing environment difference. CloudFront already forwards it.
**Consequences**: One-line `bin/` edit, recorded per coding-rules.
**Amended 2026-10-14 (D12)**: requires explicit user approval before editing. Until approved,
the alternative is to also accept the token via the `X-Auth-Token` header (which the proxy
also strips) — so there is no clean workaround; this edit will be proposed to the user at the
start of slice 1 with the exact diff.

## D8 · 2026-10-14 · Stay on JavaScript (JSX) + PropTypes, not TypeScript
**Decision**: Keep the boilerplate's JSX setup.
**Why**: Repo's `react.instructions.md` and ESLint config assume JSX + PropTypes; converting
costs hours with no grading upside. "TypeScript is fine" ≠ required.
**Consequences**: PropTypes on every component; JSDoc for shapes.

## D9 · 2026-10-14 · Hours capacity formula
**Decision**: `capacity_hours_per_member = weekdays(start..end) / 5 × 40`; project capacity = that ×
member count; cost per member = `hours_completed × salary / 2080`.
**Why**: Notes say dates "dictate the hours" and a work week is 40 h; 2080 = 52 × 40 is the
standard annualised divisor. Weekdays rather than calendar days avoids counting weekends.
**Consequences**: Formula lives in one backend module (`projects/capacity.py`) and is mirrored in
`frontend/src/utils/capacity.js` for display only. Holidays ignored (out of scope).

## D10 · 2026-10-14 · Time tracking = explicit `time_entries`, not a manually edited "hours completed" number
**Decision**: Employees log entries; completed hours are always a sum.
**Why**: "Track the project times" implies a log; a single editable number can't show budget
consumption over time and invites inconsistent edits.
**Consequences**: One extra table and two screens; but stats become derivable and testable.

## D11 · 2026-10-14 · Archive instead of delete, everywhere
**Decision**: Projects get `archived`; users get `is_active`. No `DELETE` on projects/users.
Goals and time entries are the only hard-deletable rows (low-value, author-owned).
**Why**: Explicit requirement ("we don't really delete").

## D12 · 2026-10-14 · Boilerplate files are read-only without explicit user approval
**Decision**: Nothing that existed before `context/` was created (`bin/`, `infra/`, `docs/`,
`.github/`, `backend/_examples/`, frontend config files, root files) is modified without the
user's explicit yes, given with the exact diff. New code goes in `backend/v1/`, `frontend/src/`
and `context/`. Codified in `CLAUDE.md`.
**Why**: User instruction — changes to the deployment scaffolding can break local and AWS deploys.
**Consequences**: D5 and D7 are amended above. Adding frontend dependencies (`@mui/material`,
`react-router-dom`, `vitest`, …) touches `frontend/package.json` and therefore also needs
approval — **approved and installed 2026-10-14**: `@mui/material@9`, `@mui/icons-material@9`,
`@emotion/react`, `@emotion/styled`, `react-router-dom@7`, `prop-types`; dev: `vitest@5`,
`jsdom`, `@testing-library/{react,jest-dom,user-event}`.

## D13 · 2026-10-14 · Audit log written declaratively by the router, not by each service
**Decision**: Every route in the route table may declare `audit="<entity>.<verb>"`. After a
handler returns, `router.py` calls `core/audit.record(...)` with the actor, action, entity
type/id (from path params or the created object's `id`), a sanitised request body, the status
code and a summary supplied by the handler via `Response.audit_summary`. Login success and
failure are audited too. Reads (`GET`) are not. Only admins can list the log; no API can edit it.
**Why**: Requirement M19 says *every* action by *every* role must be logged. Putting
`audit.record()` calls inside each service is the pattern most likely to be forgotten on the
next endpoint; a declaration on the route is impossible to skip silently (a mutating route with
no `audit` fails a unit test that scans the route table). Keeps services free of logging concerns.
**Consequences**: One extra table, one extra read endpoint, one admin page. Summary text quality
depends on handlers setting `audit_summary`; the router falls back to `"<action> <entityId>"`.
Audit insert happens inside the request's transaction when one is open so logs never describe
uncommitted changes.

## D14 · 2026-10-14 · "One milestone at a time" = at most one *open* milestone per employee per project
**Decision**: Interpret the clarified requirement as a uniqueness constraint on
`(project_id, user_id)` over assignments whose milestone is `open`. Completed milestones don't
count, so an employee's history across a project's milestones is preserved. Enforced in the
service (row lock + check) and by a partial unique index on `milestone_assignees` using a
denormalised `project_id` + `is_open`.
**Why**: "Can only work on one milestone at a time" is about current work, not history; a
time-based interpretation (non-overlapping date ranges) would block a manager from pre-planning
the next milestone's team. The partial index makes the rule hold even if a future code path
forgets the service check — cheaper than a trigger, and Postgres-native.
**Consequences**: Service must keep `is_open` in sync on complete/reopen (two `UPDATE`s in the
same transaction). New endpoint `GET /projects/{id}/available-assignees` for the picker.
Reopen can now 409. Removing a member from the project still cascades (M15) regardless.

## D16 · 2026-10-14 · `released_reason` on memberships (removed / completed / archived)
**Decision**: Record *why* a membership ended. Un-archiving an active project re-activates only
rows released with reason `archived`; completed projects keep counting `completed` members in
capacity so their numbers don't collapse to zero after completion.
**Why**: Without it, un-archive can't tell "released by archiving" from "removed by the manager
weeks earlier", and a finished project would show capacity 0. Added as an idempotent
`ALTER TABLE … ADD COLUMN IF NOT EXISTS` in `schema.MIGRATIONS` (first use of the D4 path).

## D15 · 2026-10-14 · One active project per employee; memberships are released, not deleted
**Decision**: `project_members.is_active` + partial unique index `(user_id) WHERE is_active`.
"Active" = project `active`, not archived, member not removed. Completing/archiving a project
releases all members; removing a member releases that row. Rows are never deleted so history,
hours and cost stay queryable and employees can still view past projects.
**Why**: Requirement changed ("an employee can only be working on one project at a time; only
once they are available can they be assigned to other teams"). Same enforcement pattern as D14
so there is one way to express "at most one X at a time" in this codebase. Keeping rows avoids
orphaning time entries and lets availability be derived from data rather than a separate
status field on `users`.
**Consequences**: Supersedes the original M8. Add-member, unarchive and log-time gain
`PROJECT_CONFLICT`/403 paths. New `GET /projects/{id}/available-members`. "Available" is a
derived state (no active membership), surfaced on user lists via `currentProject`. The capacity
formula counts active members. Seed data must include available employees.
**Confirmed 2026-10-14**: managers are not limited — a manager can manage several projects.
**Visibility after release (confirmed 2026-10-14)**: released employees keep read-only access to
non-archived projects they were on (their time entries live there; archiving is the hide
mechanism; cost data is already hidden from employees). The project detail page shows a
"released on <date>" banner with all actions hidden.

## D17 · 2026-10-13 · Minimal visual system; production-style seed IDs
**Decision**: One theme file drives the look: ink-coloured primary, soft tinted `Tag` labels instead of
filled chips, 1px borders instead of shadows, Inter typography, light + dark colour schemes via MUI CSS
variables (manual toggle, light by default). Sidebar navigation replaces the coloured app bar.
Demo seed IDs are fixed random-looking values from the same alphabet as `ids.new_id` (no `EMP001`).
**Why**: User asked for a neat, minimal, sophisticated UI; readable sequential IDs suggested a cap
(999) that the real generator (32^6 ≈ 1.07 B values) does not have.
**Consequences**: Components must not hard-code colours; use theme tokens (`theme.vars` with fallback)
so both schemes and the provider-less tests work. Status semantics: open/active = info, complete =
success, archived/deactivated = warning, released = neutral.

## D18 · 2026-10-13 · Known gaps accepted for the MVP
**Decision**: The following are consciously out of scope for the workshop deliverable. Each is listed
with the workaround in place so nobody mistakes it for an oversight.

| Gap | Today | If it mattered |
|---|---|---|
| Forced password rotation | Users change their own password on the profile page (`POST /auth/change-password`, current password required) and admins can set a temporary one (`PATCH /users/{id} {password}`). Nothing forces a change on first login. | A `must_change_password` flag set by the admin reset, checked by the login response. |
| Session expiry | JWT lives 8 h; no refresh. A `401` from any call clears the session and sends the user to the login page. | Sliding refresh token or a shorter token with silent renewal. |
| Email / notifications | Nothing is sent. Email addresses are stored for identification only. | SES on milestone due dates, goal assignment, budget overrun. |
| Pagination | ~~Only the audit log pages.~~ Closed by D23 (slice 13) and D28: users, projects, time entries, the audit log and a project's milestones page on the server (`limit` ≤ 100). Members are still returned whole (bounded by one project's team). | Page members if a team ever has hundreds. |
| Time zones | Dates are calendar dates (`DATE`), no time of day. "Today" and "this week" use the Lambda's clock (UTC) on the server and the browser's clock in the client, so near midnight the two can disagree by a day. | Pass the client's date as a query param, or store the user's time zone. |
| Hours per day cap | At most 24 h per entry; no cap on the sum of entries per day. | Reject when a day's total would exceed 24 h. |
| Capacity model | Weekdays × 8 h per member for the whole project, from the day they joined is **not** considered; public holidays and leave are ignored (D9). | Pro-rate by membership dates; a holiday calendar table. |
| Concurrency | Last write wins on `PATCH`; no `updated_at` check. Unique rules (one active project, one open milestone) are enforced by partial indexes so they hold under races. | Send `If-Unmodified-Since`/version on edits. |
| Soft delete elsewhere | Projects archive (M11). Goals and time entries are hard-deleted but every deletion is audited with the full payload, so nothing is lost silently. | Add `deleted_at` if restores are ever needed. |
| Audit log retention / export | Append-only, never pruned, admin-only UI with filters and a paging footer. No CSV export. | Export endpoint; retention job. |
| Multiple admins | Supported (the last active admin cannot be deactivated/demoted). No admin audit of other admins' permission changes beyond the normal `user.update` rows. | — |
| File uploads, comments, RAG status | Not built (stretch items S1–S4 in requirements). `goals.rag_status` column exists but is unused. | — |
| Browser E2E in CI | `frontend/e2e/` (Playwright, 12 tests across auth, projects, milestones, time + dashboards) runs locally against the dev stack with `npm run test:e2e`. The workshop CI has no Postgres/LocalStack, so it is not wired into GitHub Actions. | A CI job that starts Postgres + LocalStack, or points the suite at a deployed stack. |
| Lambda memory | Measured on AWS 2026-10-14: 96 MB of 128 MB at cold start, init ≈ 1 s. Fits; no headroom for heavier libraries. | Raise `memory_size` in `infra/lambda.tf` (boilerplate, needs approval) or drop pydantic (D3). |
| Aurora auto-pause | The workshop's Aurora Serverless v2 cluster scales to zero after 5 idle minutes and takes 15–30 s to wake. The cloud connection timeout is 45 s with one retry (`core/db.py`), so the first request after a pause is slow rather than a 502. | A keep-warm ping, or `min_capacity > 0` in `infra/rds.tf` (boilerplate). |

**Why**: Three-day workshop scope; every item above has a documented workaround and none affects the
three pillars (time, cost, resources) the assignment is graded on.
**Consequences**: Reviewers should treat these as roadmap, not defects. The table is the checklist for
a post-workshop hardening pass.

## D19 · 2026-10-14 · UX signals are computed client-side; list filters live in the URL
**Decision**: Urgency cues (milestone "Overdue" / "Due in N days", project "Past end date", the
40-hour week bar, the "Next due" marker) are derived in the browser from the calendar dates the API
already returns, using the browser's clock (`utils/dates.js`, `components/DueTag`). Search and filters
on the Projects and Users lists ~~run client-side over the whole list~~ (moved to the API in D23) and are
mirrored in the query string (`hooks/useUrlFilters`), so a filtered view is a shareable link (e.g. `/users?available=true`).
The project page keeps its tab in `?tab=`. Dashboards keep returning pre-computed lists; slice 8 extends
those payloads rather than moving the cue logic server-side.
**Why**: No new endpoint or round trip for what is purely presentation; the D18 time-zone caveat
(server vs browser "today") already applies and is acceptable for a day-granular cue. Lists are returned
whole (D18 pagination), so filtering in the browser is free and instant.
**Consequences**: ~~If pagination ever lands, search/status/role move to query params on the list
endpoints and `useUrlFilters` keeps the same shape~~ — that is what D23 did. Anything that must be *enforced* (not just shown)
stays in the services; the client only shows and hides. The audit log's action picker is fed by
`GET /audit-log/actions`, backed by the `core.audit.ACTIONS` constant that a unit test keeps equal to the
route table's `audit=` declarations (slice 9), so the UI can never offer a name the router does not record.

## D20 · 2026-10-14 · Visual identity: a display face for the figures, no template chrome
**Decision**: Two typefaces with distinct jobs: IBM Plex Serif (500/600) for page titles and headline
figures — the hours and money the product exists to show — and Inter for everything else. Both are
self-hosted from `frontend/src/assets/fonts` (OFL), so the app looks the same offline. Small labels
(stat labels, field labels, table headers) are sentence case, not tracked capitals. Facts are written as
sentences or stacked lines, never joined with " · ". Stat tiles sit flat on a tinted ground; bordered
Paper is reserved for sections and tables; tables keep a tinted header band — three levels, not one card.
Neutrals are a real ink (blue-black `#1A2233`, dark ground `#0B1220`) rather than a tinted `#111`.
The login is a two-part screen: the three pillars set as type on the left, the form on the right.
**Why**: An evaluation against Anthropic's `frontend-design` skill found the app clean but templated:
four of its five "generated page" tells were present (tracked caps labels, middle-dot meta strings,
one card for everything, tinted near-black) and nothing was memorable. The user asked for all
recommendations. The brief's own words still win: "neat, minimal, sophisticated" (D17) is kept, and
the boldness is spent in one place, the figures.
**Consequences**: Use `variant="h1…h4"` for anything that should be in the display face; never set a
font family in a component. New labels are sentence case by default (the `overline` token does it).
Do not reintroduce " · " joins; write a sentence or stack two lines. Adding a font means adding a
`.woff2` under `src/assets/fonts` and an `@font-face` in `index.css`, nothing in `package.json`.

## D21 · 2026-10-14 · Project health: one word, computed once
**Decision**: Every non-archived project gets a health word from the API, derived from the same reasons
the dashboard cues already use, with a fixed precedence: `late` (active, past its end date) → `at_risk`
(active, overdue milestone or over budget) → `needs_setup` (active, no members or no milestones) →
`to_close` (complete, not archived) → `on_track`. Archived projects are never classified; because
archiving leaves `status` untouched, "active" always means `status = active` *and* not archived. The
admin dashboard is a board of every live project sorted by that order, with portfolio sums (hours, budget)
over active projects only; the manager's cards show the same word (hidden for `to_close`, where the
status chip already says Complete and the manager cannot archive).
**Why**: The business brief asks "what is the status of each active project", "which are at risk", and
"budget consumed versus planned". A list of only the troubled projects answered none of them at a glance,
and counts of managers and employees answered nothing an admin acts on. One word per project, computed
server-side, keeps the admin board and the manager cards from ever disagreeing, and gives the admin's
own job — closing finished projects — a place on the landing page.
**Consequences**: `HEALTH_ORDER` in `dashboard/service.py` is the single source of the ordering; the
client mirrors labels in `utils/projectHealth.js` and never re-sorts. Adding a reason means deciding
which word it maps to, in `_health`, with a row in the unit matrix. The seed keeps one finished,
unarchived project so the demo shows the "Done, not archived" row and can archive it live.

## D22 · 2026-10-14 · One CloudFront rule so the hosted app's routes work (C6)
**Decision**: `infra/cloudfront.tf` gains a second `custom_error_response` mapping **403** to `/index.html`
with status 200, beside the boilerplate's 404 rule. Approved by the user with the exact diff.
**Why**: S3 returns 403, not 404, for keys that do not exist when the bucket blocks public listing, so
every React Router path except `/` (a refresh on `/projects`, a pasted link to `/login`) came back as a
CloudFront 403 page. The app itself was fine: starting at `/` and navigating inside it worked.
**Consequences**: The only infrastructure edit in the project; listed in `CLAUDE.md` under approved
boilerplate changes. A genuine missing asset now also renders the app shell instead of an error page,
which is the standard trade-off for single-page apps on CloudFront.

## D23 · 2026-10-14 · Lists page and search on the server
**Decision**: `GET /users`, `GET /projects` and `GET /projects/{id}/time-entries` take `limit` (default 25,
max 100) and `offset` beside their filters and return `Page<T> = {items, total, limit, offset}`; the search
box (`q`) and every toggle (role, available, deactivated, status, archived) are query parameters resolved in
SQL. The audit log keeps its 50/200 but shares the parser (`core/paging.py`). Milestones and members stay
whole: they are bounded by one project. The Users page's subtitle counts come from a `summary` the API
returns to admins (`people_counts()`), never from the page in hand. In the browser `DataTable` takes an
optional `pagination` prop and renders MUI's `TablePagination` footer ("26–50 of 112") whenever the list has
rows, arrows disabled on a single page so the paging is always visible; the page number lives in the URL next to the filters (`/users?available=true&page=2`),
the search box is debounced 300 ms, and changing any filter returns to page 1. The audit log's "Load more"
is replaced by the same footer. `utils/listFilters.js` is deleted.
**Why**: With everything returned whole, a 1,000-person office would ship every row to the browser on
each visit, and the Lambda's 128 MB would be spent serialising rows nobody reads. Offset paging is enough
here: lists are sorted by stable keys, writes are rare, and the audit log already used it.
**Consequences**: Clients that need *every* row of a kind (the manager pickers, the audit log's actor
list) ask for `limit=100` explicitly; past 100 managers that picker would need a search of its own.
Counts shown next to a filtered list are `total`, so "2 people match" is true across all pages. The
Time tab's hours tile names what it sums ("Hours on this page" once the entries exceed a page).

## D24 · 2026-10-14 · Hierarchy rules live in the shared components, not on pages
**Decision**: A consistency pass driven by the admin dashboard but implemented only in shared pieces, so every
page inherits it. (1) `Tag` has two weights: `tinted` for the exception (Overdue, At risk, Archived,
Deactivated, Available, a failed request) and `quiet` (a tone-coloured dot and plain text) for the normal
state (Active, Open, a role, a 2xx result). Roles keep their tone through the dot (indigo admin, ink manager,
grey employee) so a column of roles is still scannable. (2) `ProgressBar` has an `inline` layout for table
cells: bar, percentage and raw figures on one line. (3) `StatCard` sets the figure at the h3 scale, keeps the
label and hint to one line each, and takes `progress` for a captionless bar so the hint is never repeated.
(4) `DataTable` is small by default with `numeric` and `muted` column flags; `TitleCell` is the one two-line
cell (title 600 over a muted caption). (5) `SectionHeading` has a `description` slot under the title for
summaries; `aside` is for actions. (6) `HealthSummary` renders health as the tag and the reasons as one
muted line, on the admin board and the manager cards alike. (7) The sidebar name wraps instead of truncating.
Green is no longer used for "good" figures; red marks a negative and that is enough.
**Why**: The audit found the same weaknesses on every list, not just the dashboard: three pills per row,
unreadable 3 % bars, tiles whose hint repeated the bar caption, summaries flung to the far edge. Fixing
them per page would have made the dashboard special and left the rest inconsistent.
**Consequences**: Rule for new work: the normal state is text, the exception is a tag; a bar in a table is
inline with its percentage; a summary goes in the heading's description, an action in its aside. No page
sets these with its own `sx`.

## D25 · 2026-10-14 · Final polish: one grammar for status, progress, paging and summaries
**Decision**: (1) Every status and result value uses the quiet dot-and-text label: Active, Open, Complete, a 200
and a 401 alike; the semantic colour sits in the dot. Tinted tags are reserved for urgency and exceptions:
Overdue, Due in N days, At risk, Late, Archived, Deactivated, Available, a 5xx. Quiet text is always full
contrast; roles differ by dot only (purple admin, blue manager, blue-grey employee). (2) Progress in a table
row is one compact block: the percentage first in 600, the raw figures ("53 / 1,560 h", `formatRatio`) muted
beside it, the bar beneath; a non-zero value always draws at least 3 % of the track; `kind="completion"` turns
green at 100 % (goals), `kind="capacity"` turns amber at 90 % and red past 100 % (hours). (3) Every full-list
page pages at 10 rows with 10 / 25 / 50 on offer (`components/DataTable/paging.js`); the footer exists only
when the list is longer than a page; page and size live in the URL beside the filters. Dashboard tables do
not page. (4) Section summaries are `SummaryRow`s (figure emphasised, label muted, optional semantic dot) in
`SectionHeading`'s description slot, never a sentence. (5) Icon-only actions go through `ActionIconButton`
(tooltip, accessible name, one hover treatment, click never bubbles to the row). (6) Filter rows are
compact control groups, not a bordered band. (7) The project Overview has no standalone Progress panel;
the Hours tiles carry bar and percentage. (8) A manager's Projects list drops the Manager column and
searches by name; `GET /users` for a manager returns direct reports only. (9) The employee landing is
three answers: Current project (structured facts, Open project), Assigned hours used (percentage of assigned
hours), This week (`0 / 40 h`, Log time). (10) The demo seed writes the audit trail its facts imply, dated
when they would have happened, so Recent activity shows business events. (11) The admin profile hides the
meaningless $0 salary; the members tab marks the signed-in person's row with a quiet "You".
**Why**: After D24 the app still mixed generations of the same idea (a quiet Active next to a tinted
Complete, a quiet 200 next to a pill 401), bars that could not be read, lists paged three different
ways and summaries written as sentences. Each of those is a shared primitive, so the fix is in the
primitive and every page follows.
**Consequences**: Rules for new work: a status is a dot and a word; a bar in a row leads with its
percentage; a list pages at 10 through `paging.js`; a summary is a `SummaryRow`; an icon action is an
`ActionIconButton`. The only page-local presentation is the admin health summary's dots, which reuse the
health tones.

**Addendum (project card)**: `components/ProjectCard` is the one project summary. Reading order is name, health, reason,
progress, metrics; the only tinted element is the health tag; the due cue under "Next due" is quiet text; lifecycle
status appears only when it is the whole story (Complete). `ProgressBar layout="block"` and `DueTag variant="quiet"`
exist for it and for any future card.

## D26 · 2026-10-14 · CSV import of users: preview first, then all or nothing
**Decision**: `POST /users/import` takes the text of one CSV (header row, columns by name in any order) and a `dryRun`
flag. Every row is checked with exactly the rules of `POST /users` plus uniqueness inside the file, and every problem
is collected per row rather than stopping at the first. A dry run returns the report and writes nothing (and leaves no
audit row). A real import creates everybody in one transaction or nobody, returning `400` with the same report when a
row is invalid. The `manager` column is the manager's username and may point at a manager row earlier in the same
file, so a whole team imports at once; managers are created before the employees that name them. A blank password is
generated (12 URL-safe characters) and returned once in the report. The audit row stores the count and usernames,
never the file (a handler can now replace the audited details with `audit_details`, and skip the audit with
`audit_skip` for a preview).
**Why**: A recruiter asked for it: adding people one at a time does not scale to onboarding a team. Preview-then-commit
keeps the admin in control, and all-or-nothing means a half-imported file can never exist.
**Consequences**: The UI (`UserImportDialog`) always previews before it can import. Updating existing users from a file,
importing projects and Excel files are out of scope. `user.import` joins `core.audit.ACTIONS` and the action labels.

## D27 · 2026-10-15 · Goals measure work; hours measure time; salary × hours measures cost
**Decision**: Three measures, never blended. (1) **Project progress** = completed goals ÷ total goals across every
milestone of the project, computed once in `projects/schemas.goal_progress` from two correlated subqueries in the
project aggregate select and spread into the list, the detail, the stats and every dashboard card, so one project
shows one percentage everywhere; `progressPercent` is `null` when the project has no goals, and the UI's only
renderer of it, `components/GoalProgress`, then shows "—  No goals configured" rather than 0 %. (2) **Time**:
capacity used (project logged ÷ capacity), assigned hours used (member logged ÷ assigned) and weekly workload
(logged this week ÷ 40 h) keep their bars with `kind="capacity"` and are labelled as hours, never as progress or
completion. (3) **Cost**: unchanged, Σ logged hours × salary / 2,080, and budget remaining = budget − cost; assigned
hours never feed cost. Lifecycle (active / complete / archived) and computed health stay separate: 100 % of goals
completes nothing by itself and the open-milestone gate on completing a project is untouched. Milestone progress was
already goals-based and is unchanged.
**Why**: Hours spent are not work done. A team can finish in a third of its planned hours, or burn 80 % of the hours
with 30 % of the goals done; showing hours as "progress" hid exactly the comparison a manager needs. With the two
side by side ("Project progress 30 %, Capacity used 80 %, Budget consumed 85 %") the risk reads at a glance.
**Consequences**: Labels: "Progress" means goals; hours columns are "Capacity used" or "Assigned hours used"; the
employee tile is "Assigned hours used", not "My progress"; the Overview tile is "Hours logged". `hoursCompleted`
stays on the wire for compatibility. Per-person history keeps hours only (effort, not completion).

## D28 · 2026-10-15 · A project's milestones page on the server, in reading order
**Decision**: `GET /projects/{id}/milestones` takes `limit`/`offset` like every other list and returns a `Page` plus
`nextDueId`, the open milestone due soonest regardless of which page it sits on. The server orders the list the way
the tab read it: open milestones first, soonest due first, then completed ones, most recently completed first. The
Milestones tab pages at 10 / 25 / 50 with the shared footer and keeps its page in memory (the project page's URL
already carries the tab). The in-memory sorter `utils/milestones.js` is gone.
**Why**: D23 left milestones whole because a project bounds them; a 500-milestone project showed that bound is not
small. Ordering had to move with the page cut, or page 2 would start a new "open first" sequence.
**Consequences**: Any client that needs every milestone asks with `limit=100` and walks pages. The "Next due" marker
comes from the API, so it is correct on every page. Members stay whole (one team).

## D29 · 2026-10-15 · Milestone dependencies: one "waits on" link, gating completion
**Decision**: A milestone may wait on one other milestone of the same project (`milestones.blocked_by_id`, an additive
migration). The service refuses a blocker from another project, the milestone itself, or any link that would close a
loop (it walks the chain). While the blocker is open the milestone is `blocked`: goals can still be worked on, but
`POST /milestones/{id}/complete` answers `409 MILESTONE_BLOCKED` naming the blocker, and the page disables "Mark
complete" with that reason. Completing the blocker unblocks it; reopening a blocker does not reopen its dependants.
The Milestones tab shows "Waits on X" as a quiet warning cue while blocked and "After X" once X is complete; the
milestone page lists "Waits on" as a fact with a link. Demo data: Decommission's power-down and batch 2 wait on batch
1, and a new project, Office Relocation (manager ravi.mehta, team chloe.martin and samuel.osei), is a four-step chain.
**Why**: The ACME brief asked for a dependency chain between deliverables; the project-level gate (no completion with
open milestones) could not express "this phase cannot finish before that one".
**Consequences**: One blocker per milestone keeps the model a chain, not a graph; fan-in would need a join table.
Health does not yet read dependencies (a blocked milestone behind an overdue one is a natural future reason).
