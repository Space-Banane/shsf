# Copilot Instructions for SHSF

SHSF (Self-Hostable Serverless Functions) is an open-source platform for deploying and managing serverless functions on your own infrastructure. It consists of a backend API server, a web-based UI dashboard, and a CLI tool for interaction.

## Project Overview

- **SHSF** is a self-hostable serverless functions platform with three main components:
  - **Backend/**: Node.js/TypeScript API server (uses Prisma for DB, provides REST endpoints, manages functions, triggers, storage, and authentication)
  - **UI/**: React + Tailwind web dashboard for managing functions, tokens, storage, and more
  - **CLI/**: Node.js CLI tool for interacting with the backend (see `CLI/README.md`)
- Designed for easy deployment via Docker Compose (`docker-compose.yml`), with environment config in `.env`/`example.env`.

## Key Workflows

- **Start all services**: `docker-compose up -d` (from repo root)
- **Access UI**: http://localhost:3000 (default)
- **First user to register becomes admin**
- **CLI usage**: `npx shsf-cli --mode <mode> [options]` or `pnpm dlx shsf-cli ...` (see `CLI/README.md`)
- **Backend dev**: Use `pnpm` for dependency management in `Backend/` and `UI/`.
- **Prisma DB**: Schema in `Backend/prisma/schema.prisma`. Use `pnpm prisma migrate dev` in `Backend/` for DB changes.

## Patterns & Conventions

- **Functions**: User functions are managed via the UI and stored/executed by the backend. Example Python function signature:
  ```python
  def main(args):
      # ...
      return ...
  ```
- **API routes**: Organized in `Backend/src/routes/` (REST endpoints for files, functions, namespaces, storage, triggers, account, etc.)
- **Authentication**: Managed in `Backend/src/lib/Authentication.ts` and related routes.
- **Environment variables**: Managed via `.env` (see `example.env` for required keys)
- **UI**: Uses React functional components, Tailwind CSS, and organizes features by domain (see `UI/src/components/`, `UI/src/pages/`, `UI/src/services/`)
- **Testing**: No explicit test framework found; manual testing via UI/CLI is typical.

## Integration & Extensibility

- **Add new backend features**: Implement in `Backend/src/routes/` and update UI/CLI as needed.
- **External dependencies**: Managed via `pnpm` (see `package.json` in each package)
- **Docker**: All services are containerized; update `docker-compose.yml` for orchestration changes.

## Examples

- **Create a new API route**: Add a file to `Backend/src/routes/`, export a handler, it auto registers in the server.
- **Add a UI card**: Create a new component in `UI/src/components/cards/` and use it in a page.

## References

- [Backend/README.md] for backend/server details
- [UI/README.md] for UI details (if present)
- [CLI/README.md] for CLI usage and options
- [Backend/prisma/schema.prisma] for DB schema
- [docker-compose.yml] for service orchestration

---

For questions about project-specific patterns, check the relevant README or source file. When in doubt, follow the structure and conventions of existing code. When still unsure, always ask for clarification!
