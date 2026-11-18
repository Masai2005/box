# Ekilie Box

<!--toc:start-->

- [Ekilie Box](#ekilie-box)
  - [What's inside](#whats-inside)
  - [Requirements](#requirements)
  - [Build and run](#build-and-run)
  - [The composition root](#the-composition-root)
  - [Project layout](#project-layout)
  - [Configuration](#configuration)
  - [Static files](#static-files)
  - [Commands](#commands)
  - [Health and API](#health-and-api)
  - [License](#license)

<!--toc:end-->

**A single-file, all-in-one "backend-in-a-box".**

Ekilie Box compiles PocketOne/PocketBase, an embedded SQLite database, auth, file storage, realtime APIs, backups,
point-in-time restore, JS hooks, MCP, API tokens, pages, bulk mail and deploy into one portable binary.

```bash
./ekilie-box serve
```

```
> Dashboard: http://127.0.0.1:8090/_/
> REST API:  http://127.0.0.1:8090/api/
```

## What's inside

The [standard PocketOne set](https://github.com/pockethost/pocketone) is registered on every start:

|                |                                                                               |
| -------------- | ----------------------------------------------------------------------------- |
| **Database**   | Embedded SQLite with WAL, realtime subscriptions and a REST-ish records API   |
| **Auth**       | Users, OAuth2, OTP, MFA, password reset, verification, access rules           |
| **Files**      | Local or S3-compatible storage, thumbnails, protected files, signed redirects |
| **Dashboard**  | PocketBase's stock superuser UI at `/_/`                                      |
| **Extensions** | JS hooks, JS migrations, server-rendered pages (`pb_pages`)                   |
| **Safety**     | Scheduled backups and point-in-time restore (Litestream)                      |
| **Agents**     | MCP endpoint at `/mcp`, scoped API tokens (`pbt_…`) and an OAuth server       |
| **Mail**       | App SMTP, bulk campaigns, suppression list, dev mail trap                     |
| **Ops**        | Logs, SQL console, crons, deploy/pull/logs, remote management, self-upgrade   |

Ekilie Box adds:

- **Vacuum** and **dev mail trap** extensions.
- **`info`** and **`upgrade`** product commands.

## Requirements

- **Go 1.27+**

No local PocketOne checkout is needed. The PocketOne core and its `ext/*` modules are pinned to the
[`ekilie/pocketone`](https://github.com/ekilie/pocketone) fork at commit `8c6d47e` in `go.mod`'s `replace` block, so
`go mod tidy` and `go build` work on any machine with network access. PocketOne publishes the extensions as separate
Go modules, which is why the replace block is explicit.

### Updating PocketOne

Go does not support a moving branch in `go.mod`: a branch name is resolved to an immutable commit pseudo-version, so
the exact commit stays pinned and builds remain reproducible.

To follow the fork's `main` without editing versions by hand:

```bash
# update the fork first, then
make update-pocketone

# or a specific branch/tag
make update-pocketone REF=my-branch
```

The script resolves the fork at that ref, rewrites every PocketOne replace, and runs `go mod tidy`. Commit `go.mod`
and `go.sum` afterwards.

## Build and run

```bash
make build
./ekilie-box serve
```

Without the Makefile:

```bash
CGO_ENABLED=0 go build -o ekilie-box ./cmd/box
./ekilie-box serve
```

`CGO_ENABLED=0` uses the pure-Go SQLite driver, so the result is a single statically linked executable.

## The composition root

`cmd/box/main.go` decides what the product is:

```go
func main() {
    extkit.Command = app.Slug
    extkit.Version = app.Version

    box, err := app.New()
    if err != nil {
        log.Fatal(err)
    }

    extensions.Register(box) // vacuum, mail trap
    commands.Register(box)   // info, upgrade

    if err := box.Start(); err != nil {
        log.Fatal(err)
    }
}
```

`internal/app` is the wiring layer: it loads `ekiliebox.yaml`, builds the PocketBase instance, holds the
`standard.Set`, and serves an optional static directory. The admin UI is PocketBase's own.

## Project layout

```
.
├── cmd/
│   └── box/
│       └── main.go              composition root
├── internal/
│   ├── app/                     PocketBase/PocketOne setup, config, static files
│   ├── commands/                `info`, `upgrade`
│   └── extensions/              built-in extras: vacuum, mailtrap
├── ekiliebox.yaml               example config
├── .env.example                 secrets template
├── .goreleaser.yaml
├── Makefile
├── go.mod
└── go.sum
```

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

## Static files

There is no embedded site. To serve a `pb_public` folder at `/`, use the default directory next to the executable or
set it explicitly:

```bash
./ekilie-box serve --publicDir ./pb_public
```

If the directory does not exist, no static route is registered and `/` returns 404; the dashboard stays at `/_/`.

## Commands

```bash
./ekilie-box serve              # start the app
./ekilie-box info               # version, engine, paths, dashboard URL
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

- `GET /api/health` — public health check; the `X-Powered-By` header is `Ekilie Box <version>`.
- `GET /_/` — PocketBase's stock superuser dashboard.
- `GET /api/...` — records, auth, files, realtime, settings and contract APIs.

## License

MIT. PocketOne and PocketBase are MIT; see their repositories for their notices.
