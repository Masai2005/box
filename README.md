# Ekilie Box

**A single-file, all-in-one "backend-in-a-box" with a custom Ekilie Cloud-style superuser UI.**

Ekilie Box compiles PocketOne/PocketBase, an embedded SQLite database, auth, file storage, realtime APIs, backups,
point-in-time restore, JS hooks, MCP, API tokens, pages, bulk mail and deploy into one portable binary — plus its own
superuser console built with React, TanStack Router and Tailwind.

This is **not a SaaS**: there is one account type (the superuser) and one console. No customer UI, no `users`
collection requirement, no tenancy.

```bash
make build
./ekilie-box serve
```

```
> Console: http://127.0.0.1:8090/
> REST API: http://127.0.0.1:8090/api/
```

The stock PocketBase dashboard is not part of release builds (`-tags no_ui`). `/` is your console; `/api/...` is the
backend.

## Console

- Login with the PocketBase `_superusers` account.
- Dashboard overview with collections, superusers, backups, cron jobs and recent logs.
- Collections: browse collections, filter/paginate records, create/edit/delete records, dynamic field form, file
  uploads, realtime refresh, API preview, schema/rules editor and system collections.
- Logs: volume chart, filters, levels, log detail and log retention settings.
- Settings: application, mail/SMTP, storage/S3, backups/restore/PITR/vacuum, crons, API tokens, SQL console and
  collection export/import.
- Bulk mail: campaigns and suppressions.
- Ekilie Cloud design: warm paper, near-black ink, orange accent, dot grid, 2px rules, square corners, mono labels,
  light/dark themes, responsive sidebar.

Screens are single-superuser only; every API call uses `pb.collection("_superusers")` auth.

## Requirements

- **Go 1.27+**
- **Node.js 20+** (only to build the console)
- No local PocketOne checkout is needed. PocketOne core and its `ext/*` modules are pinned to the
  [`ekilie/pocketone`](https://github.com/ekilie/pocketone) fork in `go.mod`'s `replace` block, so `go mod tidy` and
  `go build` work on any machine with network access.

### Updating PocketOne

Go does not support a moving branch in `go.mod`; a branch name is resolved to an immutable commit pseudo-version.
To follow the fork's `main` without editing versions by hand:

```bash
make update-pocketone
# or
make update-pocketone REF=my-branch
```

The script rewrites every PocketOne replace and runs `go mod tidy`. Commit `go.mod` and `go.sum` afterwards.

## Build and run

```bash
# Build the console into internal/ui/dist, then the binary with no stock UI
make build

# Run without building the console (uses the committed dist)
go run -tags no_ui ./cmd/box serve

# UI hot reload: Vite proxies /api and /_ to the Go process on :8090
make dev-ui
go run -tags no_ui ./cmd/box serve
```

`CGO_ENABLED=0` uses the pure-Go SQLite driver, so the result is a single statically linked executable.

### First superuser

There is no public signup. Create the only account from the CLI:

```bash
./ekilie-box superuser upsert you@example.com 'a-strong-password'
```

Then open `http://127.0.0.1:8090/` and sign in.

### Security

Lock collection API rules to `null` (superuser-only) or set explicit rules. Superusers bypass API rules, so the
console keeps working while anonymous requests are denied. File access rules follow the same rule.

## Architecture

```
.
├── cmd/
│   └── box/
│       └── main.go              composition root
├── internal/
│   ├── app/                     PocketBase/PocketOne setup, config, static serving
│   ├── commands/                `info`, `upgrade`
│   ├── extensions/              vacuum, dev mailtrap
│   └── ui/                      //go:embed dist
│       └── dist/                built console (committed so `go build` works without Node)
├── web/                         React + TanStack Router + Tailwind console
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── lib/
│   │   └── router.tsx
│   ├── public/
│   └── package.json
├── ekiliebox.yaml               example config
├── .env.example
├── .goreleaser.yaml
├── Makefile
├── go.mod
└── go.sum
```

The Go process serves:

```
GET /             -> embedded console (SPA fallback for client routes)
GET /assets/...   -> console assets
GET /api/...      -> PocketBase/PocketOne API
GET /_/           -> not built (release uses -tags no_ui)
```

`--publicDir` can override the embedded UI with a directory (useful for debugging a Vite build from disk).

## Configuration

Ekilie Box reads `ekiliebox.yaml` (or `--config <path>`) and a `.env` beside it. Flags win over config values.
A legacy `pocketone.yaml` is still read when `ekiliebox.yaml` is not present.

```yaml
app:
  dir: ekilie_box_data
  hooks_dir: ekilie_box_hooks
  migrations_dir: ekilie_box_migrations

server:
  http: 127.0.0.1:8090

vacuum:
  enabled: true
  every: 168h

pitr:
  enabled: true
  retention: 72h
```

List every section this binary understands:

```bash
./ekilie-box config
./ekilie-box config --json
```

## Commands

```bash
./ekilie-box serve              # start the app
./ekilie-box info               # version, engine, paths, console URL
./ekilie-box info --json
./ekilie-box superuser upsert you@example.com 'a-strong-password'
./ekilie-box migrate            # run ekilie_box_migrations
./ekilie-box upgrade            # replace with the latest GitHub release, keep the old binary
```

PocketOne's contract commands are also available (`remote`, `deploy`, `dev`, `pull`, `logs`, `token`, `oauth`, `pages`,
`pitr`, ...). Run `./ekilie-box --help`.

`upgrade` expects release archives named `ekilie-box_<version>_<os>_<arch>.zip`, which is what
`.goreleaser.yaml` produces.

## Health and API

- `GET /api/health` — public health check; `X-Powered-By` is `Ekilie Box <version>`.
- `GET /` — the custom console.
- `GET /api/...` — records, auth, files, realtime, settings and contract APIs.

## License

MIT. PocketOne and PocketBase are MIT; see their repositories for their notices.
