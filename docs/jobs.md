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

## Production

Run `pnpm jobs:worker` as a separate systemd service using the same release and
environment as the web process. Send `SIGTERM` during deploys; the worker stops
fetching work, waits up to the process-manager stop deadline, and lets BullMQ
recover interrupted work as stalled jobs if necessary.

Alert on `job_failed`, `job_stalled`, `worker_error`, an increasing oldest-job
age, and queue Redis persistence or memory errors. Job logs intentionally omit
payloads and provider response bodies.
