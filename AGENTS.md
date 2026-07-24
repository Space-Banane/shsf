# SHSF – Agent Guidelines

This file is the authoritative rule set for all AI coding agents (Claude Code, Copilot, Cursor, etc.) working in this repository.

---

## What is SHSF?

**SelfHostable Serverless Functions** — a self-hosted platform for deploying and running serverless functions via a single `docker compose` stack. Users author functions through the web UI, invoke them over HTTP, and optionally use AI to generate or import function code.

---

## Repo layout

```
Backend/        Node.js + TypeScript API (rjweb-server)
  src/
    index.ts          PrismaClient singleton + server bootstrap
    lib/              Auth, Runner, GitOps, Caching, Analytics, Logging, …
    routes/           HTTP route handlers
  prisma/
    schema.prisma     Source-of-truth data model
    migrations/       Committed SQL migration history
  prisma.config.ts    Prisma 7 CLI config

UI/             React frontend (CRA, Tailwind, no external state lib)
  src/
    pages/      Route-level components
    components/ Shared UI components
    services/   API client helpers
    types/      Shared TypeScript types
    utils/      Pure utilities
```

---

## Development workflow

### Branches

```
feature/<name>  →  dev  →  main
```

Always branch from `dev`. PRs target `dev`. Only `dev` merges into `main`.

### Before every commit — mandatory checks

1. **Lint the UI:**
   ```bash
   cd UI && pnpm lint
   ```
   Do not commit if ESLint reports errors.

2. **Run backend tests:**
   ```bash
   cd Backend && pnpm test
   ```

3. **Run UI tests:**
   ```bash
   cd UI && pnpm test -- --watchAll=false
   ```

Never commit code that fails lint or any test.

---

## Database migrations – HARD RULES

### Rule 1 – Always use `prisma migrate dev` for schema changes

After **every** edit to `Backend/prisma/schema.prisma`:

```bash
cd Backend
pnpm migrate
# Give a short descriptive slug when prompted, e.g. "add_user_oauth_provider"
```

Commit the generated `migration.sql` in the same commit as the schema change.

### Rule 2 – `prisma db push` is banned

`prisma db push` mutates the database without recording a migration. **Do not use it under any circumstances.** Use `--create-only` if you need to inspect the SQL before applying:

```bash
pnpm exec prisma migrate dev --name <slug> --create-only
# review the generated SQL, then:
pnpm migrate
```

### Rule 3 – Never mutate applied migration files

Once committed, a `migration.sql` is immutable. Fix mistakes with a new migration.

### Rule 4 – Production deploys use `migrate deploy`

```bash
pnpm migrate:deploy   # non-interactive, CI-safe
```

### Rule 5 – Regenerate the client after schema changes

```bash
cd Backend && pnpm generate
```

---

## Prisma 7 architecture

| Concern | Location |
|---|---|
| Schema / data model | `Backend/prisma/schema.prisma` |
| Migration history | `Backend/prisma/migrations/` (all files committed) |
| CLI datasource config | `Backend/prisma.config.ts` |
| Runtime client | `Backend/src/index.ts` → `new PrismaClient({ adapter })` |

- Database URL: set via `prisma.config.ts` using `env("DATABASE_URL")`, **not** in `schema.prisma`.
- `PrismaClient` uses `new PrismaMariaDb(...)` as driver adapter — do not remove or bypass it.

---

## Key subsystems — read before touching

### Auth (`src/lib/Authentication.ts`)
Session-cookie auth, entirely in-house. No third-party provider. Never add unauthenticated routes or bypass session checks without explicit instruction.

### Function runner (`src/lib/Runner.ts`)
`src/lib/Runner.ts` is the public entry point for function execution — always import from here. The implementation is split across several co-located modules:
- `Runner.ts` — exported API (`executeFunction`, `buildPayloadFromGET/POST`, `installDependencies`, `buildDotnetFunction`, container lifecycle, `persistFunctionExecutionLog`)
- `RunnerRuntimeScripts.ts` — pure generator functions for per-runtime runner and init scripts (no I/O)
- `RunnerScripts.ts` — DB communication template strings and `getOrCreateFunctionDbToken`
- `DotnetProjectResolver.ts` — .NET `.sln`/`.csproj` project resolution
- `RunnerUtils.ts` — small utility and filesystem helpers
- `RunnerTypes.ts` — shared types and constants

Every function invocation flows through here. Be conservative with changes and always run the full test suite after edits.

### Inter-function calls (`callF`)
Functions can call other functions owned by the same user via the `callF` built-in. At runtime a per-execution pair of directories (`callfunc-requests/`, `callfunc-responses/`) under the execution transport dir are used; `Runner.ts` starts a `startCallFuncBridge` alongside the storage bridge to service these requests. The helper scripts (`_call_func.py`, `_call_func.js`, `callfunc/callfunc.go`) are injected unconditionally into every function's app dir. The target function is looked up by name scoped to the same `userId`, and the payload's `ran_by` field is set to `func_<callerFunctionId>`. Do not bypass this scoping — it is the sole authz boundary for cross-function calls.

### Git-backed storage (`src/lib/GitOps.ts`, `GitEditGuards.ts`)
Function source files are stored under git version control. All mutations must go through the guard layer — do not write function files directly.

### AI / code generation
The `ai_kicked_off` flag on `Function` tracks whether AI generation has been triggered. Keep this flag and the import/AI-gen flags consistent across schema, API routes, and UI components. When touching AI-related code, verify all three layers remain in sync.

### UI modals – Ctrl+Enter submits
All modals must support **Ctrl+Enter submission** using the `useShiftEnterSubmit` hook from `UI/src/hooks/useShiftEnterSubmit.ts`. When a user presses Ctrl+Enter (or Cmd+Enter on Mac) inside a modal, the primary action (create, update, delete, confirm) must fire. Import the hook and call `useShiftEnterSubmit(() => handleSubmit(), isOpen && !isLoading)` in every modal with a submit action. Do not use other keyboard shortcuts for submission.

---

## Keeping AGENTS.md and CLAUDE.md in sync – MANDATORY

`AGENTS.md` (all AI agents) and `CLAUDE.md` (Claude Code) must always reflect the same rules. Whenever you make a change that affects either file — adding a subsystem, changing a workflow step, updating a banned command, etc. — **update both files in the same commit**.

Rules:
- Any rule added to one file must be added to the other in equivalent form.
- Any rule removed or amended in one file must be removed or amended in the other.
- Do not let the two files diverge. If you notice they are out of sync, fix the gap before proceeding with your task.

---

## General coding rules

- TypeScript strict mode is on. No `any` without a comment explaining why.
- Do not use `console.log`, `console.warn`, or `console.error` in the Backend. Use `createLogger(component)` from `src/lib/logger.ts` (pino-based) instead.
- UI uses React built-ins for state — do not introduce Zustand, Redux, or similar.
- Add new route handlers under `src/routes/`, shared logic under `src/lib/`.
- Follow existing naming and file-structure conventions; don't invent new top-level folders.

---

## Quick reference

```bash
# Dev: create + apply a migration
cd Backend && pnpm migrate

# Generate TS types only (no migration)
cd Backend && pnpm generate

# Apply pending migrations in prod/CI
cd Backend && pnpm migrate:deploy

# Check migration status
cd Backend && pnpm exec prisma migrate status

# Run backend tests
cd Backend && pnpm test

# Lint UI
cd UI && pnpm lint

# Lint Backend
cd Backend && pnpm lint

# Run UI tests
cd UI && pnpm test -- --watchAll=false
```
