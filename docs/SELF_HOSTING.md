# Self-hosting Mirage

The self-hosted stack runs three long-lived roles and one one-shot role:

| Service | Purpose | Persistent data |
| --- | --- | --- |
| `app` | Next.js web application and Elysia API | None |
| `db` | PostgreSQL application data | `postgres-data` |
| `redis` | Cache, rate limits, and notification Pub/Sub | `redis-data` |
| `migrate` | Applies Drizzle migrations before app startup | None |

Postgres and Redis are internal-only. By default, the app is
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

The `migrate` container runs first. The app starts only after it exits
successfully. Inspect startup and health with:

```bash
docker compose --env-file .env.self-host -f docker-compose.self-host.yml ps
docker compose --env-file .env.self-host -f docker-compose.self-host.yml logs migrate app
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
successful migrations complete before the new app starts.

When upgrading to the Umami Cloud proxy, remove the old tracker script URL
setting from your deployment environment. To continue browser tracking, set
`NEXT_PUBLIC_UMAMI_BROWSER_ENABLED=true` before rebuilding and set
`NEXT_PUBLIC_BASE_URL` to the origin visitors use. Keep the existing Umami
website ID. Leave the browser opt-in unset for server-only deployments.
See [analytics configuration](adapters/analytics.md#configuration) for the
direct server event setting.

To collect paid subscription conversions, add `invoice.paid` to the existing
Stripe webhook endpoint. The upgrade migration creates the billing analytics
queue, and the app process retries failed deliveries while it is running.

## Backups and shutdown

Back up the PostgreSQL database and Redis volume. Test restoration before
production.

Stop containers without deleting data:

```bash
docker compose --env-file .env.self-host -f docker-compose.self-host.yml down
```

Adding `--volumes` permanently deletes the local database and Redis data and
must not be part of a normal shutdown or upgrade.

## Relationship to development Docker files

`docker-compose.yml` remains the local-development stack used by `pnpm db:up`.
`docker-compose.test.yml` is isolated test infrastructure. Production uses
`docker-compose.self-host.yml` and the same Dockerfile.

See also the production hardening items in
[`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md).
