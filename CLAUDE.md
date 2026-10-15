# CLAUDE.md

## Source of truth
`/context/*.md` governs requirements, architecture, data model, API contract, security, UI flow,
coding rules and decisions. Read the relevant file before implementing. If a change would
conflict with `/context`, stop and explain the conflict — never silently change the architecture.
Track work in `context/current-task.md`.

## Do NOT modify the initial project files
Everything that existed in the repository before `context/` was added is workshop boilerplate
(deploy scripts, Terraform, examples, docs, configs). Changing it can break local and AWS
deployment. Treat all of the following as **read-only**:

- `bin/`, `infra/`, `docs/`, `data/`, `.github/`
- `backend/_examples/`, `backend/README.md`
- `frontend/` config and scaffolding: `vite.config.js`, `eslint.config.js`, `index.html`, `package.json`,
  `.env.sample`, `README.md` (see exception below)
- Root files: `README.md`, `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `DCO.md`,
  `SECURITY.md`, `.gitignore`, `ENVIRONMENT.config`

**If a change to any of these is genuinely unavoidable, ask the user first and wait for an
explicit yes.** Explain what, why, and the exact diff. This includes "small" one-liners
(e.g. `bin/proxy-server.js`, `infra/locals.tf`, adding a dependency to `frontend/package.json`).

## Where new code goes
- Backend: `backend/v1/` (new folder; auto-deployed by the boilerplate as the `/api/v1` Lambda).
- Frontend: `frontend/src/` only. Replacing the Vite demo content in `src/` (`App.jsx`, `App.css`,
  `index.css`, `main.jsx`, `assets/`) is allowed — that is application code, not scaffolding.
- Planning/docs: `context/`.

## Files created by us so far
- `CLAUDE.md`, `PROJECT_TRACKER.md` (the solution README: architecture, setup, tests, trade-offs, known gaps), `PROJECT_TRACKER.md` (the solution README: architecture, setup, tests, trade-offs, known gaps)
- `context/` — requirements, architecture, data-model, api-contract, security, ui-flow,
  coding-rules, decisions, current-task
- `backend/.bandit` — Bandit settings for the workshop's `Security Check - Python` workflow (excludes `tests/`
  and local-only folders; app code is scanned in full).
- `backend/v1/` — the API Lambda (`function.py`, `app/{core,auth,users,projects,milestones,time_entries,dashboard,audit_log,health}`,
  `tests/`, `requirements*.txt`, `pyproject.toml`, `.gitignore`). Everything else inside it is vendored by `start-dev.sh`.
- `frontend/vitest.config.js`, `frontend/src/{auth,components,hooks,pages,services,test,utils}/`,
  `frontend/src/theme.js`; `App.jsx`, `main.jsx`, `index.css` replaced (Vite demo removed).
  Slice 7 added `utils/dates.js` (all calendar-date math; `todayISO` is re-exported from `timeEntryForm.js`),
  `utils/milestones.js`, `hooks/useUrlFilters.js`, `components/{DueTag,ListToolbar}`; slice 13 added
  `hooks/useDebouncedValue.js` and `backend/v1/app/core/paging.py`.
- `frontend/playwright.config.js`, `frontend/e2e/` — browser suite (`npm run test:e2e` with the local stack up).
  Each spec creates its own manager/employees/projects through the API (`e2e/support/api.js`), so it reruns
  without reseeding; it adds a few `e2e.*`/`mgr.*`/`emp.*` users each run (reseed to clear). Results go to
  `node_modules/.cache/e2e-results` (gitignored).

## Visual system (ui-refresh 2026-10-13, identity pass D20 2026-10-14)
- `src/theme.js` is the only place for colours/typography: ink primary, soft status tints, 1px borders
  instead of shadows, `cssVariables` + `colorSchemes` (light/dark, class selector; toggle in the sidebar).
  Use `(theme.vars || theme).palette…` or `utils/theme.js` `tint()` in components so tests (no provider) pass.
- Two faces (D20): IBM Plex Serif for `h1`–`h4` (page titles, headline figures), Inter for everything else.
  Never set `fontFamily` in a component; pick the variant. Fonts are self-hosted (`src/assets/fonts`,
  `@font-face` in `index.css`); no Google Fonts request. Small labels (`overline`, table headers) are
  sentence case by token; write labels in sentence case. Never join facts with " · ": write a sentence
  ("Oct 5 to Dec 18, 2026, managed by …") or stack two lines.
- Three container levels: `StatCard` is a flat tile on `background.default` (no border); sections are
  bordered `Paper`; tables keep the tinted header band. Don't wrap a tile in another card.
- Status/role labels use `components/Tag` (`tone` = neutral|primary|accent|success|warning|error|info),
  not MUI `Chip`. Two weights (D24/D25): every status and result value is `variant="quiet"` (semantic dot + full-contrast
  text: Active, Complete, roles, 200, 401); tinted is only for urgency and exceptions (Overdue, At risk, Archived,
  Deactivated, Available, 5xx). `RoleChip`/`StatusChip` apply this. Bars inside table cells use `ProgressBar
  layout="inline"` (percentage first, `formatRatio` raw figures muted, `kind="completion"` for goals); two-line
  cells use `components/TitleCell`; health in a row or card uses `components/HealthSummary`. `SectionHeading`
  takes `description` (a `components/SummaryRow`: `measure` = figure then unit, `tally` = category then count, never a
  sentence) and `aside` for an action only. `StatCard`
  takes `progress={{ value, max, kind }}` and `action` (one button). Icon-only actions use
  `components/ActionIconButton` (tooltip + aria-label + stopPropagation). A project summary card is
  `components/ProjectCard` (name, health tag + muted reason, `ProgressBar layout="block"`, three `FieldList` metrics,
  `DueTag variant="quiet"`; no lifecycle status unless it is the whole story). Lists page at 10 via
  `components/DataTable/paging.js` (`PAGE_SIZE`, `PAGE_SIZE_OPTIONS`); the footer shows only past one page; `page`
  and `size` live in the URL. `ListToolbar` is a bare control row, not a Paper band. Read-only label/value groups use `components/FieldList`. Page titles use
  `PageHeader` (`back={{ label, to|onClick }}` for the back link). Brand = `components/BrandMark`.
- Paper defaults to `variant="outlined"`; tables scroll sideways under 640px.
- In browser scripts, click nav links inside `getByRole('navigation', { name: 'Main navigation' })` —
  the dashboard shortcut cards are links with the same names. Nav has one people entry per role:
  employees "My team" → `/team`, managers "My team" → `/users` (searchable), admins "Users" → `/users`.
- Milestones page on the server too (D28): `milestonesApi.list(projectId, { limit, offset })` returns a `Page` with
  `nextDueId`; the tab never sorts in memory.
- Progress means goals (D27): `components/GoalProgress` is the only way to show project completion
  (`completedGoals`/`totalGoals` from the API, neutral "No goals configured" when there are none). Every hours bar is
  `ProgressBar kind="capacity"` and is labelled as hours ("Capacity used", "Assigned hours used", "Hours logged"),
  never as progress or completion. Cost is logged hours × salary / 2,080; assigned hours never feed cost.
- Bulk user creation is `POST /users/import` (D26): preview with `dryRun`, then all-or-nothing; `UserImportDialog`
  on the Users page. Handlers may set `audit_details` (replace the audited body) or `audit_skip` (a preview).
- Audit action codes are shown through `utils/auditActions.js` (`actionLabel`); add a label there whenever a
  route gains a new `audit=` name, and keep the code visible as a caption so tests/e2e can still match it.
- Urgency cues come from `components/DueTag` (`dueDate`, `isOpen`, `soonDays` — `null` for overdue-only,
  `overdueLabel`/`overdueTone` for "Past end date"); never compare dates inline. Date math only through
  `utils/dates.js` (`todayISO`, `addDays`, `daysUntil`, `dueStatus`, `weekRange`), never `new Date('YYYY-MM-DD')`.
- List pages use `ListToolbar` (search + controls) with `useUrlFilters(FILTER_DEFAULTS)` (module-level
  constant) so filters are deep-linkable; search and filters are query parameters the API resolves (D23),
  one page (25 rows) at a time with `page` in the URL and `DataTable`'s `pagination` footer. Callers that need
  every row of a kind (manager pickers, the audit log's actor list) pass `limit: 100`. The project
  page's tab is `?tab=members|milestones|time`; link to it instead of asking the user to click a tab.
  To change several filters at once use `setFilters({...})`, never `setFilter` in a loop: React Router's
  functional `setSearchParams` reads the params of the current render, so repeated calls keep only the last key.
  Audit log deep link: `/audit-log?actorId=<userId>&action=<name>` (the user page's "View activity" button).
- Project health (D21) comes from the API (`health` on dashboard cards, order in `HEALTH_ORDER`); show it with
  `components/HealthTag`, labels/tones/`REASON` in `utils/projectHealth.js` (not `health.js`, which is the API
  health client). Never compute health in the browser; hide the tag for `to_close` on manager cards.
- `StatCard` takes `to` (whole card becomes a link), `footer` (e.g. a `ProgressBar`) and `icon` (an
  Outlined icon, shown muted opposite the label); `ProgressBar` takes `color` to pin the bar colour
  (default `auto`: amber ≥ 90 %, red > 100 %). Section titles use `components/SectionHeading`
  (`icon`, `title`, `aside`). Icons: always the `…Outlined` variant, decorative (no `titleAccess`),
  never as the only carrier of meaning; labels and roles are facts in `FieldList`, not chips beside buttons.

## Demo data
`backend/v1/app/core/seed.py` loads on a database that has only the bootstrap admin
(skipped when `SEED_DEMO_DATA=false`, which the tests set). Seed IDs are fixed but production-style
(random-looking, same alphabet as `ids.new_id`); e.g. john.doe = `7NW8G4`, PRJ "Decommission 1,000
Servers" = `FLZ38Y`. Never use readable prefixes like `EMP001` — they imply a sequence that caps out. Accounts: `admin` / `Admin123!`;
everyone else / `Password1!` — managers `priya.natarajan`, `marcus.bell`, `elena.vasquez`;
employees e.g. `john.doe`, `aisha.rahman`, `daniel.kim`. To reload locally: truncate all tables in
the `postgres` database, touch `backend/v1/function.py`, then **call `/api/v1/health` once** — the hot
reload only re-runs the schema init + seed on the next invocation, so without a request the database
stays empty (polling `SELECT count(*)` alone can wait forever). Seeded ~10 s after the call.

## AWS deployment (done 2026-10-14)
- `./bin/deploy-backend.sh aws` (refreshes `ENVIRONMENT.config` credentials via the workshop API, Terraform
  apply, ≈ 4 min for a Lambda change) then `./bin/deploy-frontend.sh aws` (Vite build, S3 sync, CloudFront
  invalidation, ≈ 2 min). Site: https://d2f2rff70xkxny.cloudfront.net · API: same host + `/api/v1`.
  Lambda `coding-workshop-v1-ae7479c0`, region **us-east-2** (`export AWS_REGION=us-east-2` for `aws logs tail
  /aws/lambda/coding-workshop-v1-ae7479c0 --since 10m` after `source ENVIRONMENT.config`).
- Aurora pauses after 5 idle minutes; the first request then takes 15–30 s (D18). Before a demo, hit the
  site once a few minutes early. `ENVIRONMENT.config` holds temporary credentials and is gitignored — never commit it.

## Local tooling (not committed)
- Backend venv: `backend/v1/.venv` → `.venv/bin/pytest`, `.venv/bin/ruff check .`; Bandit exactly as CI runs it (CI installs the
  latest Bandit, so keep the venv current with `.venv/bin/pip install -U bandit`; 1.9 flags any `"password": "…"` dict entry), from the
  repo root: `backend/v1/.venv/bin/bandit -r ./backend` (reads `backend/.bandit`; must exit 0)
- Frontend: `npx vitest run`, `npm run lint` (from `frontend/`)
- Browser checks: no system Chrome and no sudo on the VDI. Playwright's bundled Chromium is in
  `~/.cache/ms-playwright` (revision 1194 ↔ playwright 1.56.1, which is why `@playwright/test` is pinned);
  the Playwright MCP server is registered with `--browser chromium`. The repo suite is `frontend/e2e/`;
  the older scratchpad walkthroughs (`pw/walkthrough*.mjs`, `pw/reseed.sh`) are superseded by it. The Playwright MCP writes its snapshots to `.playwright-mcp/` in the repo root —
  delete that folder before committing (`.gitignore` is boilerplate, read-only).
- Icon imports: check `node_modules/@mui/icons-material/<Name>.js` exists before using a name
  (e.g. `PersonOutlined`, `DeleteOutlined` — not `PersonOutline`/`DeleteOutline`); Vitest will not
  catch a bad import in a file no test renders, but Vite fails the whole page.
- Never run two Bash calls in parallel that both `cd`: the shared working directory races and files
  land in the wrong tree. Use `( cd dir && … )` subshells or absolute paths.
- MUI is **v9**: no system props on `Box`/`Stack`/`Typography` (use `sx`), `TextField` uses
  `slotProps.{input,htmlInput,inputLabel,select}`, `<TextField select>` label renders as a `<div>`
  (query selects by `role="combobox"` in tests), Dialog/Snackbar `onClose(event, reason)`.
- Known quirk: the `pip` on PATH is Python **3.14**, the Lambda runtime is **3.13**, so
  `start-dev.sh`'s vendoring step fails silently (`No module named 'psycopg'` in Lambda logs).
  Vendor with the 3.13 venv instead, whenever `requirements.txt` changes:
  `backend/v1/.venv/bin/pip install --target backend/v1 -r backend/v1/requirements.txt`

## Boilerplate files modified with explicit approval
- `frontend/package.json` / `package-lock.json` — 2026-10-14, added MUI, React Router, PropTypes,
  Vitest + Testing Library, and the two ESLint plugins `eslint.config.js` already imported but
  never declared (decisions.md D12 note).
- `bin/proxy-server.js` — 2026-10-14, one line: forward the `Authorization` header (D7).
- `frontend/package.json` — 2026-10-13, added `@playwright/test@1.56.1` (dev) and the
  `test:e2e` script (user approved).
- `README.md` — 2026-10-14, one pointer line to `PROJECT_TRACKER.md` (the solution's README; the root README is
  boilerplate, so the document lives beside it). User approved.
- `README.md` — 2026-10-14, one pointer line to `PROJECT_TRACKER.md` (the solution README lives beside the
  boilerplate one). User approved.
- `infra/cloudfront.tf` — 2026-10-14, one `custom_error_response` block mapping S3's 403 to `/index.html`
  (same as the existing 404 one) so deep links and refreshes work on the hosted app (user approved, C6).

Keep this list updated as new top-level files/folders are added.

## Working agreement
- No implementation code until the user approves the plan in `context/current-task.md`.
- One slice at a time; follow `context/coding-rules.md`.
- Commit/push only when asked.
