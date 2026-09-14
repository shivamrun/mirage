# Operations runbook

This runbook covers the production checks that are visible from this repository.
Provider dashboards, managed Postgres settings, object-storage policy and host
rollback controls still need to be filled in from the deployed environment.

## Deployment smoke test

Run after each deploy, with `SMOKE_TEST_BASE_URL` set to the deployed origin:

```bash
SMOKE_TEST_BASE_URL=https://example.com pnpm smoke
```

The smoke test checks:

- `/api/health` returns `ok: true` and confirms database connectivity.

Treat a smoke-test failure as a blocked deploy until the failed check is
understood. If `/api/health` reports `checks.database: "error"`, verify the
runtime `DATABASE_URL`, network allowlist, migration state and database service
health before sending user traffic.

## Request IDs and logs

API route handlers attach an `x-request-id` response header. If a client or edge
proxy sends `x-request-id`, that value is preserved; otherwise the application
generates one. Application request logs are JSON objects with
`event: "http_request"` or `event: "http_request_error"`.

When debugging an incident:

1. Capture the `x-request-id` from the failing response.
2. Search application logs for that request ID.
3. Correlate the request method, path, status and duration with database and
   provider logs from the same time window.

## Metrics

`/api/admin/metrics` exposes process-local JSON counters for request totals,
per-route counts, 5xx counts, total duration and max duration. It requires
verified admin access. These metrics reset when an application process restarts
and are not a replacement for a production metrics backend.

Minimum production dashboards should track:

- request count and 5xx count by route;
- p95 and p99 request duration by route;
- Postgres query duration for admin list/search routes;
- Postgres connection utilization;
- email send success/failure and provider latency;
- auth failures, verification sends and rate-limit rejections.

## Database connection budget

`src/server/db/index.ts` opens one lazy Postgres.js client per Node process.
The per-process connection cap is:

- `DB_POOL_MAX`, when set;
- otherwise `10` in production;
- otherwise `5` in development and test.

Budget total possible connections as:

```text
max_app_processes * DB_POOL_MAX <= managed_database_connection_limit - reserved_admin_connections
```

Use a lower `DB_POOL_MAX` or an external pooler when the host can create many
concurrent Node processes or serverless instances. `prepare: false` is already
set for compatibility with common transaction-pooling deployments.

## Migrations

Do not edit existing migration files directly.

Normal migration flow:

1. Update the Drizzle schema under `src/server/db/schema`.
2. Generate a migration with `pnpm db:generate`.
3. Review the generated SQL.
4. Run `pnpm lint` and `pnpm build`.
5. Apply migrations in staging with `pnpm db:migrate`.
6. Run `pnpm db:seed` for fresh environments or when seed data changes.
7. Run the smoke test against staging.
8. Apply migrations in production during the approved deploy window.
9. Run the production smoke test.

Before production migrations, confirm that a recent backup exists and that the
restore procedure below has been tested for the selected database provider.

## Backup and restore

The repository does not define the production database provider, so exact backup
commands are provider-specific. The deployment owner should document the
provider-native backup schedule, retention period, encryption, access controls
and restore target.

Minimum policy:

- automated daily backups for production;
- point-in-time recovery when supported by the provider;
- a restore drill before launch and after material schema changes;
- restricted access to backup exports;
- a written maximum acceptable data loss and restore time.

Restore drill:

1. Create an isolated restore database from the selected backup or timestamp.
2. Point a staging app instance at the restored database.
3. Run `pnpm db:migrate` if the restored snapshot predates current migrations.
4. Run `pnpm db:seed` if default data is missing.
5. Run the smoke test against the staging app.
6. Verify representative login, admin list and public form flows.
7. Record backup timestamp, restore duration, migration result and smoke-test
   result in the incident or release notes.

Production restore should be approved explicitly because it can overwrite newer
data. Prefer restoring into a new database and switching the application
connection string after verification.
