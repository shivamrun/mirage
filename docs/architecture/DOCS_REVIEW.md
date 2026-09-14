# Review of the architecture documentation

Reviewed on 2026-09-12 against the maintained source files and the six original architecture documents in this directory. This is a static architecture and documentation review; production configuration, traffic and live database behavior remain **Unknown / needs verification**. The preceding review ran `pnpm build` successfully and found three existing Biome formatting errors. This review ran `pnpm depcruise`, which reported four boundary violations in two source modules.

**Current-state update (2026-09-13):** The failing checks above are historical baseline evidence. The direct Drizzle violations and formatting failures are resolved, a focused Vitest/Postgres suite now covers the critical workflows, and both admin API families enforce verified email. `pnpm test`, `pnpm lint`, `pnpm depcruise`, and `pnpm build` pass.

## Overall assessment

The documents give a useful, mostly accurate picture of the actual application. `SYSTEM_CONTEXT.md` is the best single-file handoff: it identifies Mirage as a starter platform and traces the two API families, Postgres auth/data, email, object upload and content paths. `ARCHITECTURE.md` contains the right three diagrams and explains server/client boundaries. `CODEBASE_MAP.md` avoids generated-file noise. `SCALABILITY.md` correctly resists prescribing infrastructure from user counts. `ARCHITECTURE_REVIEW.md` ties most findings to real modules. The original `REFACTOR_PLAN.md` named sensible priorities but did not tell an engineer how to make, test or ship each change; it has been rewritten with why/what/how and completion checks.

## Corrections made in this review

| Documentation issue | Evidence | Correction |
|---|---|---|
| Dependency policy was described only as an abstract coupling concern, despite a failing check. | `.dependency-cruiser.js` forbids the direct DB/schema imports in `src/server/routes/admin/index.ts` and `src/server/account/two-factor.ts`; `pnpm depcruise` reported four errors. | Added a concrete finding to `ARCHITECTURE_REVIEW.md`, noted it in `SYSTEM_CONTEXT.md`, `ARCHITECTURE.md` and `CODEBASE_MAP.md`, and included a bounded fix in the plan. |
| The module diagram could be read as claiming browser client code imports server auth/routes. | `src/lib/auth/client.ts` and `src/lib/api/client.ts` make HTTP requests; `src/app/(backend)/api` provides server handlers. | Labeled those diagram edges as HTTP calls, and the DAL-to-admin-query edge as a type import in `ARCHITECTURE.md`. |
| The refactor list lacked implementation decisions and success criteria. | Earlier `REFACTOR_PLAN.md` listed tasks but not rollout order, verification or failure cases. | Replaced it with phased why/what/how, done-when checks, explicit concurrency/authorization test cases, and trigger-based later work. |
| The developer-experience score omitted failed baseline checks. | `pnpm lint` had three formatting errors; `pnpm depcruise` had four dependency violations. | Lowered the score from 7 to 6 and dated the check evidence in `ARCHITECTURE_REVIEW.md`. |

## Remaining documentation limits

- The numeric scores in `ARCHITECTURE_REVIEW.md` are judgments, not measured service-level indicators. Keep their evidence and date attached; do not treat them as a release gate.
- The 10k/100k/1M+ sections of `SCALABILITY.md` are prompts to inspect workload, not capacity forecasts. A mostly idle million-account installation can be easier to serve than a small installation with intense writes. Use request concurrency, row counts, query plans and provider throughput for actual sizing.
- Better Auth's limiter now uses database storage, but its trusted-IP and cookie behavior must still be verified against the deployed proxy/runtime. Verified-email enforcement for Better Auth admin routes is provided by `src/app/(backend)/api/auth/[...all]/route.ts` and covered by integration tests.
- The repo proves an S3 signing path, but not bucket ACL, CDN behavior, object retention, managed Postgres topology, backup strategy or deployment host. Keep these marked **Unknown / needs verification** rather than replacing them with assumptions (`src/lib/uploads/server`, `docker-compose.yml`, `src/lib/env.ts`).
- The focused executable test suite and repository-level operations runbook are now present. Provider-specific backup settings, production p95/query-plan evidence, alerting and deployment topology remain pending until the actual deployment is known.

## How to keep these docs useful

Update `SYSTEM_CONTEXT.md` when an entry point, datastore, provider or deployment assumption changes. Update the relevant flow/diagram in `ARCHITECTURE.md` when transport or ownership changes. Revise findings in `ARCHITECTURE_REVIEW.md` only when the code or measured evidence changes, then close or reorder the corresponding phase in `REFACTOR_PLAN.md`. Keep dated verification results separate from permanent system facts. This is documentation maintenance guidance for these specific files, not a request for a new architecture process.
