# SHSF CLI

## Installation & Usage

### Run directly (no install):

```
npx shsf-cli --mode <mode> [options]
```

or with pnpm:

```
pnpm dlx shsf-cli --mode <mode> [options]
```

### Install globally:

```
npm install -g shsf-cli
# or
pnpm add -g shsf-cli
```

Then use anywhere:

```
shsf-cli --mode <mode> [options]
```

---

# New CLI Commands

## Update Execution Alias

Update the execution alias for a function via the API:

```
npx shsf-cli --mode update-alias --project <path> --link <functionId> --alias <newAlias>
```

- `<project>`: Path to your function project folder
- `<link>`: Numeric function ID
- `<alias>`: New execution alias (8-128 chars, alphanumeric, hyphens, underscores)

## Execute Function

Invoke a function using the `/api/exec/{namespaceId}/{functionId}/{route}` endpoint:

```
npx shsf-cli --mode exec --project <path> --link <functionId> --route <route> [--method <GET|POST>] [--body <json>]
```

- `<project>`: Path to your function project folder
- `<link>`: Numeric function ID
- `<route>`: Route string (as defined in your function)
- `--method`: HTTP method (default: POST)
- `--body`: JSON string for POST body (optional)

Both commands use `.meta.json` in your project folder to pull `namespaceId` and `executionId` automatically.

See `--help` for all options.
# SHSF CLI
Command Line Interface for SHSF