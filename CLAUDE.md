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

UI/             React frontend (Vite, Tailwind, no external state lib)
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

### Addressing review feedback

After fixing review feedback, push the changes and report the result. Do not request or re-request external PR reviews, including review-bot reviews, unless the user explicitly asks. Do not add reviewers or use comments, mentions, or bot commands to trigger another review automatically.

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
   cd UI && pnpm test
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

Commit the generated migration SQL in the same commit as the schema change.

### Rule 2 – `prisma db push` is banned

`prisma db push` mutates the database without recording a migration. **Do not use it under any circumstances.** Use `--create-only` if you need to inspect the SQL before applying:

```bash
pnpm exec prisma migrate dev --name <slug> --create-only
# review the generated SQL, then:
pnpm migrate
```

### Rule 3 – Never mutate applied migration files

Once committed, a migration file is immutable. Fix mistakes with a new migration.

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

- Database URL: set via `Backend/prisma.config.ts` using `env("DATABASE_URL")`, **not** in `Backend/prisma/schema.prisma`.
- `PrismaClient` uses `new PrismaMariaDb(...)` as driver adapter — do not remove or bypass it.

---

## Key subsystems — read before touching

### Auth (`Backend/src/lib/Authentication.ts`)
Session-cookie auth, entirely in-house. No third-party provider. Never add unauthenticated routes or bypass session checks without explicit instruction.

### Function runner (`Backend/src/lib/Runner.ts`)
`Backend/src/lib/Runner.ts` is the public entry point for function execution — always import from here. The implementation is split across several co-located modules:
- `Backend/src/lib/Runner.ts` — public API and payload/dependency helpers
- `Backend/src/lib/RunnerInvocation.ts`, `Backend/src/lib/RunnerSource.ts`, `Backend/src/lib/RunnerContainer.ts`, `Backend/src/lib/RunnerCleanup.ts` — invocation, source preparation, container lifecycle, and cleanup
- `Backend/src/lib/RunnerRuntimeAdapter.ts` — runtime execution commands
- `Backend/src/lib/RunnerExecutionLog.ts` — execution log persistence
- `Backend/src/lib/RunnerRuntimeScripts.ts` — pure generator functions for per-runtime runner and init scripts (no I/O)
- `Backend/src/lib/RunnerScripts.ts` — DB communication template strings and `getOrCreateFunctionDbToken`
- `Backend/src/lib/RunnerUtils.ts` — small utility and filesystem helpers
- `Backend/src/lib/RunnerTypes.ts` — shared types and constants

Every function invocation flows through here. Be conservative with changes and always run the full test suite after edits.

### Inter-function calls (`callF`)
Functions can call other functions owned by the same user via the `callF` built-in. At runtime a per-execution pair of directories (callfunc-requests and callfunc-responses) under the execution transport dir are used; `Backend/src/lib/RunnerInvocation.ts` starts a `startCallFuncBridge` alongside the storage bridge to service these requests. The runtime-specific callF helper is injected into every function's app directory. The target function is looked up by name scoped to the same `userId`, and the payload's `ran_by` field is set to `func_<callerFunctionId>`. Do not bypass this scoping — it is the sole authz boundary for cross-function calls.

### Git-backed storage (`Backend/src/lib/GitOps.ts`, `Backend/src/lib/GitEditGuards.ts`)
Function source files are stored under git version control. All mutations must go through the guard layer — do not write function files directly.

### AI / code generation
The `ai_kicked_off` flag on `Function` tracks whether AI generation has been triggered. Keep this flag and the import/AI-gen flags consistent across schema, API routes, and UI components. When touching AI-related code, verify all three layers remain in sync.

### Groups and sharing (`Backend/src/lib/Sharing.ts`)
Resources are owned by one user; `ResourceShare` grants a namespace, function, or storage to a user or an admin-managed `Group`. Permissions are ordered `view` < `execute` < `edit`; storage supports `view` and `edit`. A namespace grant applies to every function in it but never to storage. Delete, rename, sharing, guest access, moving namespaces, Docker mount, and clone stay owner-only. Every function, namespace, and storage lookup must filter through `functionAccessWhere` / `namespaceAccessWhere` / `storageAccessWhere`; never match on `userId` alone for a resource a recipient may reach. Shared functions still run as their owner (owner's storage, env, and `callF` scope). Group membership and share changes go through `audit()`. SSO (#65) maps provider groups through `syncSsoGroupMembership`, which only touches `source: sso` memberships.

### Updater (`Backend/src/lib/Updater.ts`, `Backend/src/lib/UpdaterCompose.ts`)
Self-update is a durable `UpdateOperation` row (phases preflight, pull, replacement, migration, verification, completion, rollback, failure; terminal states completed, failed, cancelled, rolled_back). `Backend/src/lib/Updater.ts` prepares and monitors; `Backend/src/lib/UpdaterCompose.ts` is pure (Compose layout resolution, the helper container's shell script, output parsing, timeouts). The helper replaces only the updater-managed service, pinned to an image ID via a generated override, verifies readiness through `GET /ready` and rolls back on failure. Never report success before the helper reports `completed`, never overwrite a terminal state (`patch` only updates `running` rows), keep every wait bounded by `UPDATE_TIMEOUTS`, and keep shell values quoted or validated. Configuration is `UPDATE_*` in `Backend/src/lib/env.ts` and `example.env`. `Backend/src/tests/UpdaterHelper.integration.test.ts` runs the real script against Docker and skips when Docker is unavailable.

### Log analysis (`Backend/src/lib/LogAnalysis.ts`, `Backend/src/lib/OpenRouterDecisions.ts`)
Opt-in advisory analysis of execution logs through OpenRouter's Decisions API. Effective only when the account (`User.logAnalysisEnabled` + `logAnalysisModel`) and the function's logging config (`analyze: true`) are both on. `persistFunctionExecutionLog` enqueues a `LogAnalysis` row; the `log-analysis` system cron drains it. Never send unsanitized logs (always go through `buildDecisionsRequest`), never log keys or request bodies, never hardcode a model, and never let analysis change a log's exit code or `result`. Keep `Backend/src/lib/OpenRouterDecisions.ts` separate from the chat-completion code in `Backend/src/lib/AIProvider.ts`.

### UI modals – Ctrl+Enter submits
All modals must support **Ctrl+Enter submission** using the `useShiftEnterSubmit` hook from `UI/src/hooks/useShiftEnterSubmit.ts`. When a user presses Ctrl+Enter (or Cmd+Enter on Mac) inside a modal, the primary action (create, update, delete, confirm) must fire. Import the hook and call `useShiftEnterSubmit(() => handleSubmit(), isOpen && !isLoading)` in every modal with a submit action. Do not use other keyboard shortcuts for submission.

---

## Maintain these instructions

When a change adds, renames, or removes a path, script, or subsystem named here, update its section in the same PR. The `scripts/check-agent-docs.mjs` check validates references and the generated copy. Run `node scripts/check-agent-docs.mjs` locally. Run `node scripts/check-agent-docs.mjs --write` to regenerate the copy.

---

## General coding rules

- TypeScript strict mode is on. No `any` without a comment explaining why.
- Do not use `console.log`, `console.warn`, or `console.error` in the Backend. Use `createLogger(component)` from `Backend/src/lib/logger.ts` (pino-based) instead.
- UI uses React built-ins for state — do not introduce Zustand, Redux, or similar.
- Add new route handlers under `Backend/src/routes/`, shared logic under `Backend/src/lib/`.
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
cd UI && pnpm test
```
