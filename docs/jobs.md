# Durable background jobs

Mirage uses BullMQ for durable background work. Notification Redis Pub/Sub is
separate and remains a best-effort realtime transport.

## Local development

Start Postgres and the AOF-backed Redis service, then run the web and worker
processes separately:

```bash
pnpm db:up
pnpm dev
pnpm jobs:worker
```

To run the worker in Docker instead, opt into its Compose profile:

```bash
docker compose --profile jobs up -d worker
pnpm jobs:health
```

`JOBS_REDIS_URL` selects the queue Redis instance and falls back to
`REDIS_URL` for local development. Production should use a dedicated Redis
instance configured with AOF and `maxmemory-policy noeviction`.

## Job contract

Job names, Zod payload schemas, retry policies, priorities, and queue routing
live in `src/server/jobs/registry.ts`. Payloads are validated both when enqueued
and when processed. Add versioned names for incompatible payload changes.

Use provider-level request timeouts for external work (for example, the Stripe
client uses a 30-second timeout). Do not implement job timeouts by racing an
unabortable operation: that can leave the first side effect running while BullMQ
retries it.

Business idempotency belongs in Postgres. BullMQ job IDs only suppress duplicate
queue entries while the original job is retained. Stripe credits remain guarded
by the unique credit-ledger idempotency key, and durable email sends use database
delivery records plus provider idempotency keys.

Use `scheduleJob(name, payload, { runAt, jobId })` for one-off delayed work.
The stable job ID should identify the underlying business action. Past times are
enqueued immediately.

Recurring definitions live in `src/server/jobs/schedules.ts`. Each worker
idempotently upserts the same BullMQ scheduler IDs during startup, so multiple
instances do not create independent cron streams. Schedules enqueue durable
jobs rather than running business logic during startup. Current schedules
recover pending Stripe/email work every minute and start a bounded subscription
reconciliation scan daily at 02:15 UTC.

Run `pnpm jobs:schedules:sync` to upsert definitions without removing anything.
After old worker versions have drained, `pnpm jobs:schedules:prune` also removes
obsolete Mirage-owned scheduler IDs. Never prune during a mixed-version rolling
deployment.

## Production

Run `pnpm jobs:worker` as a separate systemd service using the same release and
environment as the web process. Send `SIGTERM` during deploys; the worker stops
fetching work, waits up to the process-manager stop deadline, and lets BullMQ
recover interrupted work as stalled jobs if necessary.

Each process refreshes a Redis heartbeat every 15 seconds with a 45-second TTL.
`pnpm jobs:health` exits non-zero when Redis is unavailable or no fresh worker
heartbeat exists. `RELEASE_ID` or `GIT_SHA`, when set, is included in the
heartbeat.

An example systemd unit is:

```ini
[Unit]
Description=Mirage background jobs
After=network-online.target

[Service]
Type=simple
User=mirage
Group=mirage
WorkingDirectory=/srv/mirage/current
EnvironmentFile=/srv/mirage/shared/.env
ExecStart=/usr/bin/pnpm jobs:worker
ExecStop=/bin/kill -s TERM $MAINPID
Restart=always
RestartSec=5
TimeoutStopSec=35
KillSignal=SIGTERM
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Deploy it from the same release as the web process, after migrations. Once old
workers have stopped, run `pnpm jobs:schedules:prune` from the new release.

Alert on `job_failed`, `job_stalled`, `worker_error`, an increasing oldest-job
age from `queue_health`, `worker_heartbeat_error`, and queue Redis persistence
or memory errors. Job logs intentionally omit payloads and provider response
bodies.
