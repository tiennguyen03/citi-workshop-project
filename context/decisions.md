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
| Pagination | Only the audit log pages (`limit`/`offset`). Users, projects, milestones, entries are returned whole; fine at workshop scale (tens to low hundreds of rows). | Add `limit`/`offset` to the list endpoints; the `DataTable` already takes rows, not fetches. |
| Time zones | Dates are calendar dates (`DATE`), no time of day. "Today" and "this week" use the Lambda's clock (UTC) on the server and the browser's clock in the client, so near midnight the two can disagree by a day. | Pass the client's date as a query param, or store the user's time zone. |
| Hours per day cap | At most 24 h per entry; no cap on the sum of entries per day. | Reject when a day's total would exceed 24 h. |
| Capacity model | Weekdays × 8 h per member for the whole project, from the day they joined is **not** considered; public holidays and leave are ignored (D9). | Pro-rate by membership dates; a holiday calendar table. |
| Concurrency | Last write wins on `PATCH`; no `updated_at` check. Unique rules (one active project, one open milestone) are enforced by partial indexes so they hold under races. | Send `If-Unmodified-Since`/version on edits. |
| Soft delete elsewhere | Projects archive (M11). Goals and time entries are hard-deleted but every deletion is audited with the full payload, so nothing is lost silently. | Add `deleted_at` if restores are ever needed. |
| Audit log retention / export | Append-only, never pruned, admin-only UI with filters and "load more". No CSV export. | Export endpoint; retention job. |
| Multiple admins | Supported (the last active admin cannot be deactivated/demoted). No admin audit of other admins' permission changes beyond the normal `user.update` rows. | — |
| File uploads, comments, RAG status | Not built (stretch items S1–S4 in requirements). `goals.rag_status` column exists but is unused. | — |
| Browser E2E in CI | `frontend/e2e/` (Playwright, 12 tests across auth, projects, milestones, time + dashboards) runs locally against the dev stack with `npm run test:e2e`. The workshop CI has no Postgres/LocalStack, so it is not wired into GitHub Actions. | A CI job that starts Postgres + LocalStack, or points the suite at a deployed stack. |
| Lambda memory | LocalStack reports the full 128 MB used at cold start (pydantic + psycopg). Not yet measured on AWS; deploy deferred by the user. | Measure on first deploy; fallback is hand-written validators instead of pydantic (D3). |

**Why**: Three-day workshop scope; every item above has a documented workaround and none affects the
three pillars (time, cost, resources) the assignment is graded on.
**Consequences**: Reviewers should treat these as roadmap, not defects. The table is the checklist for
a post-workshop hardening pass.
