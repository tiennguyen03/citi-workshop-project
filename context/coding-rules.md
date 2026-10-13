# Coding Rules

Purpose: prevent architectural drift and spaghetti over three days of fast iteration.
`/context` is the source of truth. If a change requires violating a rule, stop, explain the
conflict, update the relevant context file first, then code.

## Process rules

1. **One feature at a time.** `current-task.md` names the feature, its acceptance criteria and files. Work outside that list is a new task.
2. **Contract first.** Before implementing an endpoint, it must exist in `api-contract.md`. Before adding a column, it must exist in `data-model.md`.
3. **Thin slices.** Backend endpoint + test, then frontend page + test, then run end-to-end locally. Never build five endpoints before any is called by the UI.
4. **No speculative abstractions.** Generic "BaseRepository", plugin systems, event buses: not until a third concrete use exists.
5. **Every PR-sized change is runnable**: `pytest` green, `npm run lint` green, app boots via `./bin/start-dev.sh`.
6. **Commits**: small, descriptive, one concern each. Don't commit generated/env files (`.env.local`, `.pip_installed`, `node_modules`, vendored pip packages in `backend/v1/`).

## Backend rules (Python, `backend/v1/`)

- **Layering is one-directional**: `function.py → router → handlers → services → repositories → db`. A module may import only from layers to its right and from `core/`. Lint by code review: `grep -rn "from app.*handlers" app/` must return nothing outside `router.py`.
- **Handlers** ≤ ~20 lines: parse DTO, call one service function, return `Response`. No `if role ==` in handlers.
- **Permission checks only in `core/permissions.py`**, called from services. Grep for `role ==` outside that file is a review failure.
- **All SQL in `*/repository.py`**, parameterised, one function per query, returning dicts. No SQL in services or handlers. No ORM.
- **Column names are declared once** in `core/schema.py`; repositories use explicit column lists, never `SELECT *`.
- **Errors**: raise `AppError` subclasses from services; never return error dicts. The router maps them. Never `except Exception: pass`.
- **Validation**: pydantic DTOs with `extra="forbid"`, camelCase aliases. Business validation (cross-field, DB-dependent) lives in services.
- **IDs**: `core/ids.new_id()` using `secrets`. Never `random`.
- **Dates/money**: `datetime.date` and `decimal.Decimal` internally; serialise at the edge in `http.py`.
- **Transactions**: multi-write operations use `with db.transaction() as conn:`. Never partial writes.
- **No module-level side effects** except the DB connection cache and the once-per-cold-start schema init guard.
- **Style**: PEP 8, type hints on every function, docstrings on public functions (repo's `python.instructions.md`). `ruff`-clean. Bandit-clean (no `assert`, no `shell=True`, no hard-coded secrets outside the `IS_LOCAL` dev fallback, which gets a `# nosec` with justification).
- **Tests**: `tests/unit` use fake repositories (plain classes) — no mocking library gymnastics. `tests/integration` hit a real local Postgres database `tracker_test`, created by the test fixture, truncated between tests. Each endpoint gets at least: happy path, validation error, forbidden role.
- **Config** read once in `core/config.py`; nothing else calls `os.getenv`.

## Frontend rules (React, `frontend/src/`)

- **Data flow**: `pages/* → hooks/useApi → services/*.js → services/client.js`. Components under `components/` never fetch and never import from `services/`.
- **One API function per endpoint** in `services/*.js`, named after the contract (`projects.addMember`). No inline `fetch` anywhere else.
- **Permission visibility** via `useAuth().user.role` and `RoleGate`; never duplicate business rules beyond show/hide and enabled/disabled.
- **State**: local `useState` + `useApi`; the only context is `AuthContext`. No Redux/Zustand/React Query in MVP.
- **Forms**: controlled inputs, a `useForm`-free plain pattern (`values`, `errors`, `setField`), submit disabled while pending, server field errors mapped by `details.field`.
- **Components** are presentational and typed with `PropTypes` (repo's `react.instructions.md`); JSDoc on exported components.
- **Files**: one component per file, PascalCase; hooks `useX.js`; pages in `pages/<Name>/<Name>Page.jsx` with co-located `*.test.jsx`.
- **Styling**: MUI `sx` and theme; no CSS files beyond `index.css` resets. Remove the Vite demo CSS/assets.
- **No TypeScript migration mid-project** (D8). ESLint (repo config + react-hooks) must be clean.
- **Tests**: Vitest + React Testing Library; `services/*` mocked at module boundary (`vi.mock('../services/projects')`). Each page: renders with data, shows empty state, shows error state; each form: validation + submit calls the API with the right payload.

## Naming
- API wire: camelCase. DB: snake_case. Python: snake_case. React: camelCase / PascalCase.
- Boolean fields start with `is`/`has`/`can` (`isDone`, `archived` is the one legacy exception kept for readability in the requirements).
- Status enums are lowercase strings exactly as in `data-model.md`.

## Things that require a `decisions.md` entry before doing them
Adding a dependency · adding a Lambda folder · adding a table · changing auth · adding a new top-level frontend directory.

## Things that require the user's explicit approval before doing them (D12, `CLAUDE.md`)
Any edit to a pre-existing boilerplate file: `bin/`, `infra/`, `docs/`, `.github/`, `data/`,
`backend/_examples/`, `frontend/package.json` and other frontend config, root README/configs.
Ask with the exact diff and wait for a yes.
