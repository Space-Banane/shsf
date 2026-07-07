# SHSF — Self-Hostable Serverless Functions

[![CI](https://gitea.reversed.dev/shsf/shsf/actions/workflows/ci.yml/badge.svg)](https://gitea.reversed.dev/shsf/shsf/actions)
[![Discord](https://img.shields.io/discord/1475098530505953441?style=flat)](https://discord.gg/shsf)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> Because why would you use AWS Lambda when you have a Raspberry Pi, home lab, or an old laptop lying around?

**SHSF** is a self-hosted serverless functions platform that lets you deploy and invoke code over HTTP without managing infrastructure. It ships as a single `docker compose` stack and includes a full-featured web UI, multi-runtime support, cron scheduling, response caching, Git-backed version control, and optional AI-assisted code generation.

---

> **Migrated from GitHub to Gitea**
>
> This project was originally hosted at [github.com/Space-Banane/shsf](https://github.com/Space-Banane/shsf).
> We moved to a self-hosted [Gitea](https://gitea.reversed.dev/shsf/shsf) instance for better reliability and more control.
> GitHub's reliability track record has been a recurring concern ([see historical status](https://mrshu.github.io/github-statuses)), and self-hosting gives us the freedom to operate on our own terms. The GitHub repository remains as a mirror but is no longer the primary source.

---

## Features

- **Multi-runtime** — Python (3.9–3.15), Go (1.20–1.23), and C#/.NET (8.0–10.0)
- **HTTP invocation** — every function gets a unique endpoint; supports human-readable execution aliases
- **Cron triggers** — schedule functions with standard cron expressions; manual re-runs supported from the UI
- **Web editor** — Monaco-based in-browser code editor with multi-file support
- **AI code generation** — generate function code from a prompt using your own [OpenRouter](https://openrouter.ai) API key
- **Response caching** — payload-keyed cache with configurable TTL (1 s – 24 h)
- **Git-backed source** — link any function to a Git repository with optional periodic auto-pull
- **Persistent storage** — per-user key-value storage accessible across function invocations (with optional TTL)
- **Rate limiting** — per-function, configurable request rate limits
- **Guest access** — create limited guest accounts with per-function access control
- **Access tokens** — API keys for headless / CI workflows (no browser session required)
- **Analytics & logs** — execution history, duration metrics, stdout/stderr capture
- **Docker extras** — optional FFmpeg and OpenCV installs, Docker-in-Docker mount, and outbound network restriction per function
- **Static site serving** — point a function's startup file to an `.html` file to serve static content
- **OpenAPI export** — live schema export for all registered functions

---

## Requirements

| Requirement | Notes |
|---|---|
| Docker + Compose plugin | `docker compose` v2 |
| MySQL / MariaDB | External or via the optional compose service |
| 512 MB RAM minimum | More recommended if running many concurrent functions |
| A modern browser | Chrome, Firefox, Edge, Safari |

---

## Installation

### 1 — Clone the repository

```bash
git clone https://gitea.reversed.dev/shsf/shsf.git
cd shsf
```

### 2 — Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set the required variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | MySQL/MariaDB connection string |
| `PORT` | Public application port |
| `DOMAIN` | Cookie domain (e.g. `localhost`) |
| `UI_URL` | Full URL to the UI (used for CORS) |
| `REACT_APP_API_URL` | Full URL to the backend API |
| `CORS_URLS` | Additional comma-separated CORS origins |
| `INSTANCE_SECRET` | Random secret — **change the default in production** |

An optional MariaDB service block is included (commented out) in `docker-compose.yml` if you do not have an external database.

### 3 — Start the stack

```bash
docker compose up -d
```

### 4 — Access the web UI

Open `http://localhost:<PORT>` in your browser. The first registered account is automatically promoted to admin.

---

### Runtime data directory

SHSF stores function files, container caches, and execution artifacts in an OS-specific location:

| Environment | Path |
|---|---|
| Linux / Docker | `/opt/shsf_data` |
| Windows (local dev) | `./shsf_data` inside the `Backend/` folder |

This keeps Docker bind mounts valid on Windows while using the standard `/opt/shsf_data` layout in production.

---

## Usage

1. **Register** — the first account becomes admin; subsequent accounts require registration to be open.
2. **Create a namespace** — namespaces are organisational folders for your functions.
3. **Create a function** — pick a runtime, write your code in the Monaco editor, and save.
4. **Invoke your function**:
   - Click **Run** in the UI
   - `POST /api/function/{id}/execute` (or use your execution alias)
   - Set up a **cron trigger** for scheduled runs
5. **Configure extras** — CORS, rate limits, caching, Git sync, environment variables, Docker options, and more are all available in the function settings panel.

---

## Function structure

Every function receives an `args` object containing the full request context.

### Python

```python
def main(args):
    body = args.get('body', {})
    name = body.get('name', 'World')
    return f"Hello, {name}!"
```

### Go

```go
package main

import "fmt"

func main_user(args interface{}) (interface{}, error) {
    payload, _ := args.(map[string]interface{})
    name := "World"
    if body, ok := payload["body"].(map[string]interface{}); ok {
        if n, ok := body["name"].(string); ok {
            name = n
        }
    }
    return fmt.Sprintf("Hello, %s!", name), nil
}
```

### C# / .NET

```csharp
using System;

public class Function
{
    public static object Main(dynamic args)
    {
        string name = args?.body?.name ?? "World";
        return $"Hello, {name}!";
    }
}
```

The `args` payload includes `body` (parsed request body), `query` (query string params), `headers`, and metadata about the invocation.

---

## Architecture overview

```
┌─────────────────────────────────────────────────┐
│                  Docker Compose                  │
│                                                 │
│  ┌──────────────┐       ┌─────────────────────┐ │
│  │   React UI   │──────▶│   Node.js Backend   │ │
│  │  (port UI)   │  HTTP │   (rjweb-server)    │ │
│  └──────────────┘       └────────┬────────────┘ │
│                                  │               │
│                    ┌─────────────┼────────────┐  │
│                    │             │            │  │
│             ┌──────▼──┐  ┌──────▼──┐  ┌─────▼─┐│
│             │ MariaDB  │  │  Docker  │  │  Git  ││
│             │ (Prisma) │  │ (runner) │  │ (VCS) ││
│             └──────────┘  └──────────┘  └───────┘│
└─────────────────────────────────────────────────┘
```

- **Backend** — TypeScript API built on [rjweb-server](https://github.com/rotvproHD/NPM_WEB-SERVER), using Prisma 7 with a MariaDB adapter
- **Runner** — manages Docker container lifecycle for each function execution; handles streaming output, payload marshalling, retries, and log capture
- **GitOps** — wraps Git operations behind atomic write guards; supports periodic auto-pull from remote repositories
- **Caching** — payload-hashed LRU cache with per-function TTL stored in MariaDB
- **Authentication** — session-cookie auth; no third-party provider; access tokens for API workflows; separate guest session model

---

## Development

### Prerequisites

- Node.js 20+
- pnpm
- A running MariaDB instance
- Docker (for function execution)

### Starting locally

```bash
# Backend (terminal 1)
cd Backend
cp .env.example .env   # fill in DATABASE_URL etc.
pnpm install
pnpm dev               # esbuild watch + node

# UI (terminal 2)
cd UI
pnpm install
pnpm tailwind:watch    # Tailwind CSS watch (separate terminal or background)
pnpm dev               # react-scripts on port 443
```

### Before committing

```bash
# Lint the UI
cd UI && pnpm lint

# Lint + test the backend
cd Backend && pnpm lint && pnpm test
```

### Database migrations

```bash
cd Backend

# After editing prisma/schema.prisma, create a migration:
pnpm migrate           # prompts for a slug (e.g. "add_cache_ttl_index")

# In CI / production:
pnpm migrate:deploy    # non-interactive, safe for automated deployments
```

> **Never use `prisma db push`** — it skips migration history and makes rollbacks impossible.

### Branch strategy

```
feature/<name>  →  dev  →  main
```

Cut a `feature/` branch from `dev`, open a PR into `dev` when ready, and let `dev` merge into `main` for releases.

---

## Contributing

1. Fork the repository on [Gitea](https://gitea.reversed.dev/shsf/shsf)
2. Create a `feature/<name>` branch
3. Make your changes, ensure lint and tests pass
4. Open a pull request into `dev`

Bug reports and feature requests are welcome via the Gitea issue tracker.

---

## License

MIT — see [LICENSE](LICENSE) for details.
