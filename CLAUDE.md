# SHSF – Claude Code Guidelines

## What is SHSF?

**SelfHostable Serverless Functions** — a self-hosted platform for deploying and running serverless functions, packaged as a single `docker compose` stack. Users write functions, manage them via the web UI, and invoke them over HTTP. The platform handles routing, rate limiting, analytics, logging, and AI-assisted code generation.

---

## Repo layout

```
Backend/        Node.js + TypeScript API (rjweb-server)
  src/
    index.ts          PrismaClient singleton + server bootstrap
    lib/              Shared utilities (Runner, GitOps, Auth, Caching, …)
    routes/           rjweb-server route handlers
  prisma/
    schema.prisma     Source-of-truth data model
    migrations/       Ordered SQL migration history (all files committed)
  prisma.config.ts    Prisma 7 CLI config (datasource URL, paths)

UI/             React frontend (no external state management lib)
  src/
    pages/      Route-level page components
    components/ Reusable UI components (buttons, cards, modals, motion, ui)
    services/   API client helpers
    types/      Shared TypeScript types
    utils/      Pure utility functions

scripts/        Dev/ops helper scripts
docker-compose.yml  Single-file deployment unit
```

---

## Stack

| Layer | Technology |
|---|---|
| Backend runtime | Node.js + TypeScript (strict mode) |
| HTTP server | rjweb-server |
| ORM | Prisma 7 (`@prisma/adapter-mariadb`) |
| Database | MySQL / MariaDB |
| Frontend | React (Create React App), Tailwind CSS |
| Package manager | pnpm (both workspaces) |
| Backend tests | Vitest |
| Frontend tests | react-scripts test (Jest) |
| Linting (UI) | ESLint (`eslint-config-react-app`) |
| Linting (Backend) | ESLint (`@typescript-eslint/recommended`) |

---

## Development workflow

### Branch strategy

```
feature/<name>  →  dev  →  main
```

- Cut a `feature/` branch from `dev` for every piece of work.
- Open a PR into `dev` when the feature is ready.
- `main` is the stable/release branch; only `dev` merges into it.

### Starting the app locally

```bash
# Backend
cd Backend
pnpm dev          # builds with esbuild and starts the server

# UI (separate terminal)
cd UI
pnpm dev          # react-scripts start on port 443
pnpm tailwind:watch   # if editing CSS
```

### Before committing

1. **UI — always lint:**
   ```bash
   cd UI
   pnpm lint
   ```
2. **Backend — always lint:**
   ```bash
   cd Backend
   pnpm lint
   ```
3. **Backend — run the test suite:**
   ```bash
   cd Backend
   pnpm test           # vitest run
   ```
4. **UI — run tests:**
   ```bash
   cd UI
   pnpm test -- --watchAll=false
   ```

Never commit code that fails lint or tests.

---

## Key subsystems

### Auth
Session-cookie auth, fully managed by the backend (`Backend/src/lib/Authentication.ts`). No third-party auth provider. Do not bypass session checks or add unauthenticated routes without explicit approval.

### Function runner
`Backend/src/lib/Runner.ts` is the public entry point for function execution — always import from here. The implementation is split across several co-located modules:
- `Runner.ts` — exported API (`executeFunction`, `buildPayloadFromGET/POST`, `installDependencies`, `buildDotnetFunction`, container lifecycle, `persistFunctionExecutionLog`)
- `RunnerRuntimeScripts.ts` — pure generator functions for per-runtime runner and init scripts (no I/O)
- `RunnerScripts.ts` — DB communication template strings and `getOrCreateFunctionDbToken`
- `DotnetProjectResolver.ts` — .NET `.sln`/`.csproj` project resolution
- `RunnerUtils.ts` — small utility and filesystem helpers
- `RunnerTypes.ts` — shared types and constants

Changes here affect every function invocation — test thoroughly and be conservative.

### AI / code generation
The AI feature generates function code from a prompt or file import. The `ai_kicked_off` flag on a `Function` record tracks whether generation has been triggered. Generation is initiated from the UI and calls the backend which calls the AI provider. Keep the flag lifecycle (`ai_kicked_off`, import/AI gen flags) consistent across schema, API, and UI.

### Git-backed storage
`Backend/src/lib/GitOps.ts` and `GitEditGuards.ts` manage function source files under version control. Treat these as sensitive — mutations must go through the guard layer.

### UI modals – Ctrl+Enter submits
All modals must support **Ctrl+Enter submission** using the `useShiftEnterSubmit` hook from `UI/src/hooks/useShiftEnterSubmit.ts`. When a user presses Ctrl+Enter (or Cmd+Enter on Mac) inside a modal, the primary action (create, update, delete, confirm) must fire. Import the hook and call `useShiftEnterSubmit(() => handleSubmit(), isOpen && !isLoading)` in every modal with a submit action. Do not use other keyboard shortcuts for submission.

---

## Database migrations – MANDATORY rules

> **Never use `prisma db push` or `prisma db pull` to evolve the schema.**

### When you change `prisma/schema.prisma`:

1. **Create a migration immediately:**
   ```bash
   cd Backend
   pnpm migrate          # runs: npx prisma migrate dev
   # Give a short descriptive slug, e.g. "add_user_oauth_provider"
   ```

2. **Commit the generated file** at `Backend/prisma/migrations/<timestamp>_<name>/migration.sql` together with the schema change.

3. **Never hand-edit applied `migration.sql` files.** Create a new migration instead.

4. **Production deployments:**
   ```bash
   pnpm migrate:deploy   # npx prisma migrate deploy — no prompts, CI-safe
   ```

### Forbidden commands

| Command | Why banned |
|---|---|
| `npx prisma db push` | Skips migration history; rollbacks impossible |
| `npx prisma db pull` | Overwrites schema from DB, erases intent |
| Editing an applied `migration.sql` | Corrupts checksum; deploy will fail |

### Prisma 7 specifics

- Database URL lives in `prisma.config.ts` (via `env("DATABASE_URL")`), **not** in `schema.prisma`.
- `PrismaClient` is instantiated with a `PrismaMariaDb` driver adapter — do not remove it.
- Run `pnpm generate` if you only need updated TS types without a DB migration.

---

## Keeping CLAUDE.md and AGENTS.md in sync – MANDATORY

`CLAUDE.md` (Claude Code) and `AGENTS.md` (all other AI agents) must always reflect the same rules. Whenever you make a change that affects either file — adding a subsystem, changing a workflow step, updating a banned command, etc. — **update both files in the same commit**.

Rules:
- Any rule added to one file must be added to the other in equivalent form.
- Any rule removed or amended in one file must be removed or amended in the other.
- Do not let the two files diverge. If you notice they are out of sync, fix the gap before proceeding with your task.

---

## General coding rules

- TypeScript strict mode is on. Do not use `any` without a comment explaining why.
- Do not use `console.log/warn/error` in the Backend. Use `createLogger(component)` from `src/lib/logger.ts` (pino-based) instead.
- UI state is managed with React built-ins (`useState`, `useContext`) — do not introduce external state libraries without discussion.
- Follow existing file/folder conventions: route handlers in `src/routes/`, shared logic in `src/lib/`.
