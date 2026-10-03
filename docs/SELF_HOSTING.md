# Self-hosting Mirage

The self-hosted stack runs five long-lived roles and one one-shot role:

| Service | Purpose | Persistent data |
| --- | --- | --- |
| `app` | Next.js web application and Elysia API | None |
| `worker` | BullMQ background jobs and recurring schedule registration | None |
| `db` | PostgreSQL application data | `postgres-data` |
| `redis` | Cache, rate limits, and notification Pub/Sub | `redis-data` |
| `jobs-redis` | Durable BullMQ queues and worker heartbeats | `jobs-redis-data` |
| `migrate` | Applies Drizzle migrations before app/worker startup | None |

The two Redis services are intentionally separate. Queue Redis uses AOF and
`noeviction`; cache or realtime traffic therefore cannot evict queued work.
Postgres and both Redis services are internal-only. By default, the app is
published only on `127.0.0.1:3000` for a host-level reverse proxy.

## Requirements

- Docker Engine with the Compose v2 plugin
- A DNS name and TLS-terminating reverse proxy (Caddy, nginx, Traefik, or an
  equivalent edge)
- Cloudflare Turnstile, Stripe, and Resend credentials
- Optional Google OAuth and S3-compatible object storage credentials

The application currently validates Stripe and Turnstile settings at startup,
and production email flows require Resend. They are not bundled as local
containers.

## First deployment

Copy and fill the environment template:

```bash
cp .env.self-host.example .env.self-host
chmod 600 .env.self-host
```

`DATABASE_URL` must point at the Compose hostname `db` and match the Postgres
credentials. URL-encode reserved characters in its password. Public
`NEXT_PUBLIC_*` values are compiled into the browser bundle, so changing one
requires rebuilding the app image.

Build and start the stack:

```bash
docker compose \
  --env-file .env.self-host \
  -f docker-compose.self-host.yml \
  up -d --build
```

The `migrate` container runs first. The app and worker start only after it exits
successfully. Inspect startup and health with:

```bash
docker compose --env-file .env.self-host -f docker-compose.self-host.yml ps
docker compose --env-file .env.self-host -f docker-compose.self-host.yml logs migrate app worker
curl --fail http://127.0.0.1:3000/api/health
```

Point the reverse proxy at `127.0.0.1:3000`, preserve the `Host` header, and
overwrite (rather than append to) its client-IP header. Only then set
`TRUSTED_CLIENT_IP_HEADER` to that header. Configure the Stripe webhook at:

```text
https://<your-domain>/api/auth/stripe/webhook
```

## Upgrades

Back up Postgres before an upgrade, pull the new source, then rerun the same
`up -d --build` command. Compose recreates the one-shot migration container;
successful migrations complete before the new app and worker start. After old
workers have drained, prune obsolete recurring schedules with:

```bash
docker compose --env-file .env.self-host -f docker-compose.self-host.yml exec worker pnpm jobs:schedules:prune
```

Do not run schedule pruning while old and new worker versions are both active.

## Backups and shutdown

Back up the PostgreSQL database and all three named volumes. PostgreSQL is the
source of truth for business idempotency; the jobs Redis volume contains
in-flight and retained background work. Test restoration before production.

Stop containers without deleting data:

```bash
docker compose --env-file .env.self-host -f docker-compose.self-host.yml down
```

Adding `--volumes` permanently deletes the local database and Redis data and
must not be part of a normal shutdown or upgrade.

## Relationship to development Docker files

`docker-compose.yml` remains the local-development stack used by `pnpm db:up`.
Its optional `jobs` profile reuses the multi-stage `Dockerfile`'s worker target
with development settings. `docker-compose.test.yml` is isolated test
infrastructure. Production uses `docker-compose.self-host.yml` and the same
Dockerfile, which prevents worker image drift between environments.

See also the production hardening items in
[`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md) and worker behavior in
[`jobs.md`](jobs.md).
