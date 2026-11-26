# Ekilie Control Plane

Ekilie Box is a single-app backend. The control plane is a separate product for running many instances, deploying services and managing a fleet.

This document defines the boundary and the first implementation plan. It is intentionally not part of the Ekilie Box binary.

## Product boundary

| Product | Responsibility |
|---|---|
| Ekilie Box | One app: database, auth, files, realtime, console, backups, crons |
| Ekilie Control Plane | Many apps: provisioning, routing, deploys, secrets, domains, teams, billing |

The control plane must not fake fleet features inside the single-app console. A user running one app should never need a control-plane account.

## Building blocks

- `multisite`: many instances behind one listener, routed by hostname.
- `pocker`: in-process isolate runtime for instances.
- `docker`: container runtime for instances.
- `edge`: forwards requests to the edge that owns an instance.
- `mothership`: fleet control plane and edge coordination.
- `deploy` and `remotes`: deploy APIs and remote app sources.
- `firewall`: host peer allow-lists, trusted proxies and rate limits.
- `servertiming` and `stats`: host observability.

## Architecture

```
Browser
  |
  v
Control plane UI  --->  Control plane API
                            |
              +-------------+-------------+
              |                           |
          Mothership                   Deploy API
              |                           |
        +-----+-----+               build artifacts
        |           |
      Edge A      Edge B
        |           |
     Multisite   Multisite
        |           |
      Pocker      Pocker
        |           |
    instances   instances
```

The control plane owns desired state. Edges own request routing. Runtimes own process and data isolation.

## Data model

Collections in the control-plane app:

- `cp_services`: id, name, slug, repo, runtime, region, status, created
- `cp_instances`: id, service, edge, folder, version, status, last_seen
- `cp_deploys`: id, service, commit, status, started, finished, log_url
- `cp_domains`: id, instance, hostname, tls_status, verified
- `cp_env_groups`: id, service, name
- `cp_env_vars`: id, group, key, value_ref, secret
- `cp_team_members`: id, email, role, status
- `cp_audit_events`: id, actor, action, target, metadata, created

Secrets are references. Plaintext values live in an encrypted settings key or an external secret store, never in list responses.

## API surface

- `GET /api/cp/services`
- `POST /api/cp/services`
- `POST /api/cp/services/{id}/deploys`
- `GET /api/cp/services/{id}/deploys`
- `POST /api/cp/deploys/{id}/rollback`
- `GET /api/cp/instances`
- `POST /api/cp/instances/{id}/restart`
- `GET /api/cp/domains`
- `POST /api/cp/domains/{id}/verify`
- `GET /api/cp/metrics?service=...&range=24h`
- `GET /api/cp/audit`

The control-plane API uses its own auth collection and role model. It does not expose the Ekilie Box superuser session.

## UI

Separate React app and route tree, for example `control.ekilie.com`:

- Services list with status, region, version and last deploy
- Service detail: deploy timeline, logs, environment, domains, metrics
- Deploy detail: build log stream and rollback
- Domains and certificate status
- Team, roles, audit and billing
- Fleet view: edges, instances and routing health

Visual language can reuse the Ekilie console components, but navigation and permissions are separate.

## Phases

### Phase 1: read-only inventory

Read services, instances, edges and deploys from mothership or a provider. No mutations. This validates the data model and gives operators visibility.

### Phase 2: deploy and restart

Add deploy creation, cancellation, rollback and instance restart. Build logs stream over SSE. Every action is written to `cp_audit_events`.

### Phase 3: domains and secrets

Add domain verification, TLS status, environment groups and secret references. Secrets are write-only in the UI.

### Phase 4: teams and billing

Add members, roles, invitations, plans and usage. Billing is provider-specific and should be a separate integration.

### Phase 5: scaling

Add health checks, instance counts, autoscaling policies and region placement.

## Security requirements

- Control-plane auth is separate from app superusers.
- Secrets are encrypted at rest and never returned by list APIs.
- Every mutation is audited with actor, action, target and request ID.
- Edge-to-edge traffic uses a private network and mutual authentication.
- Deploy artifacts are signed or checksum-verified.
- Rate limits and IP allow-lists are enforced at the edge.
- A compromised instance cannot access another instance's files or database.

## Out of scope for Ekilie Box

Do not add these to the single-app binary:

- service and instance lists
- deploy timelines and build logs
- environment groups
- domain and certificate management
- teams and billing
- fleet metrics and scaling

The single-app console can show a link to the control plane, but it should not pretend to manage a fleet.
