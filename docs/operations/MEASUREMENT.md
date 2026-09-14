# Measurement checklist

This file records the production evidence needed before making capacity claims.
Local tests prove behavior; they do not prove production latency or query plans.

## p95 latency evidence

Capture p95 request latency from the production metrics backend for:

- `/api/health`;
- public contact and email-list POSTs;
- login/session-heavy auth routes;
- account email and two-factor routes;
- admin users, contact submissions and email-list pages;
- upload signing.

Record the date, traffic window, deployment version, database size and whether
the numbers came from real production traffic or a production-like load test.

## Query-plan evidence

Capture `EXPLAIN (ANALYZE, BUFFERS)` for representative admin queries at current
or seeded production-like row counts:

- admin user search and sort;
- contact submission filters and search;
- email subscriber filters and search;
- rate-limit lookup/update paths if public form traffic grows.

Do not add broad indexes from guesswork. Add targeted indexes only when plans
show sequential scans, expensive sorts or count work on a path that matters for
actual usage.

## Current evidence log

| Date | Environment | Evidence | Result |
|---|---|---|---|
| 2026-09-14 | Repository | `pnpm smoke` script added | Requires a running deployment to execute. |
| 2026-09-14 | Repository | `/api/health` checks database connectivity | Implemented in app code. |
| 2026-09-14 | Repository | `/api/admin/metrics` exposes process-local request metrics | Implemented in app code; external metrics backend still needed for p95. |
