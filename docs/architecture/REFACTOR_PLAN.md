# Architecture improvement plan

This plan improves the existing single Next.js application. It does not require a new framework, service boundary, cache tier or queue. The evidence and priority for each item are in `ARCHITECTURE_REVIEW.md`; current request paths and module ownership are in `ARCHITECTURE.md` and `CODEBASE_MAP.md`. Production topology, traffic and provider limits are **Unknown / needs verification**. Prioritize by observed risk and workload, not account count alone.

## Improvement by review dimension

| Aspect | Why it needs work | What should improve | How to judge progress |
|---|---|---|---|
| Security | **Complete at the application layer.** Public and email-send limits now use durable application storage; verified-admin and atomic-token protections are complete. | Keep shared abuse budgets and throttled account email sends; revisit trusted client identity after hosting is selected. | Current focused tests pass; provider-specific two-instance trust assumptions remain part of Phase 0 hosting verification. |
| Scalability | Admin inboxes read all rows, built-in lists are upserted on requests, and DB connection/query costs are unmeasured. | Bounded pages, one-time seeding, connection and query budgets. | Fixed response/page bounds, no foreground seed writes, measured p95/query plans. |
| Maintainability | **Partially complete.** Focused workflow modules and tests exist; some broader DAL/data-lifecycle cleanup remains. | Keep simple SQL in DAL; move only growing workflows/contracts to focused modules. | A change to admin UI query controls does not require a DAL import from `components`; focused workflow tests exist. |
| Separation of concerns | **Complete for the reviewed dependency violations.** Direct Drizzle/schema violations are resolved and DAL modules no longer import UI query contracts. | Keep neutral contracts in server-safe modules without generic repositories. | `pnpm depcruise` remains green and DAL modules do not depend on UI folders. |
| Developer experience | Focused tests and green local checks now exist; a deployment runbook still depends on the first hosting setup. | Keep checks green and document production operations when the host is selected. | `pnpm test`, `pnpm lint`, `pnpm depcruise`, and `pnpm build` pass, and a new engineer can execute the release/rollback runbook. |

## Order of work

| Phase | Outcome | Depends on |
|---|---|---|
| 0. Establish a baseline | Know the deployed trust boundary, check state and critical workflow behavior | Access to deployment settings and a test database |
| 1. Close access and abuse gaps | Consistent verified-admin policy and durable rate limits | Phase 0 proxy/header facts |
| 2. Make state changes safe | Atomic email/2FA transitions and retryable delivery | Focused concurrency tests |
| 3. Bound data paths | Paginated admin inboxes and intentional list seeding | Current UI/filter behavior |
| 4. Align modules and operations | Passing architecture checks, useful observability and measured query tuning | Earlier behavioral changes |

These are deployable slices, not a single rewrite. Fixes within a phase can be separate PRs. Keep the current schemas and URLs unless a specific slice requires a change. Do not edit committed migrations by hand; if a schema change is needed, change `src/server/db/schema` and run `pnpm db:generate` as required by `AGENTS.md`.

## Phase 0 — establish the facts and a repeatable check

**Status (2026-09-13):** The isolated Postgres/Vitest harness and critical workflow tests are complete. `pnpm test`, `pnpm lint`, `pnpm depcruise`, and `pnpm build` pass. Hosting facts and the deployment/rollback runbook remain pending until a host is selected.

**Why:** The code can prove application behavior, but it cannot prove how proxy headers, replicas, S3 or database pooling work in production. Security and scaling decisions depend on those facts. The failing lint and dependency checks recorded in the 2026-09-12 baseline have been fixed.

**What:** Record the production host/runtime, replica or invocation model, trusted client-IP source, Postgres connection limit/pooler, Better Auth origin/cookie setup, Resend limits, S3 bucket/public URL policy, migration order and backup/restore owner. Preserve a dated check baseline, and add a small test harness for the behavior being changed first.

**How:** Add a deployment runbook under `docs/architecture` after inspecting actual infrastructure; mark any unavailable fact **Unknown / needs verification**. Use an isolated test Postgres database and Vitest or another focused runner for custom route/workflow tests. First write tests for unverified-admin access, duplicate token use, 2FA failure counts and public limit identity. Do not make a broad test framework project. Fix the two non-generated lint files through Biome; handle the generated `drizzle/meta/_journal.json` formatting problem by configuration/tooling rather than editing migration output directly. Re-run `pnpm build`, `pnpm lint`, and `pnpm depcruise` after the relevant changes.

**Done when:** The deployment trust facts have an owner and source, critical existing behavior is covered by focused tests, and check failures are either fixed or explicitly isolated with a narrow documented exception.

## Phase 1 — access and abuse boundaries

### 1A. Apply one verified-admin rule to all admin entry points

**Status (2026-09-13): Complete.** The Elysia admin macro requires the admin role and verified email. The `/api/auth/admin/*` wrapper applies the same verified-email rule before Better Auth handles the request. Tests cover visitors, normal users, unverified admins, and verified admins against representative reads and mutations.

**Why:** `/admin` pages already blocked unverified admins, while both API families needed the same policy at their own request boundaries.

**What:** Define whether email verification is a requirement for every admin mutation and read. The current UI says yes; use that as the default policy unless product owners explicitly change it. Apply it to Elysia admin endpoints and verify Better Auth admin plugin endpoints too.

**How:** `src/server/routes/auth.ts` checks a fresh user record for role and email verification. `src/app/(backend)/api/auth/[...all]/route.ts` checks Better Auth admin requests before delegation. Page gating remains the user-facing verification flow; neither API relies on `src/proxy.ts`.

**Done when:** Unverified admins cannot use either admin API family, verified admins retain access, and the policy is defined in one server-owned place. Roll out with an account-recovery path for existing unverified admins.

### 1B. Replace process-local limits and throttle email sends

**Status (2026-09-13): Complete at the application layer.** Public contact and signup budgets are stored in Postgres and shared by all app instances. Account verification, both stages of email-change delivery, and 2FA sends have durable per-account and per-destination cooldowns. Better Auth's client-request limiter also uses database storage instead of process memory. All custom-route `429` responses include `Retry-After`, application limiter identifiers are keyed digests, and expired application counters are pruned in bounded batches. Because no host is selected yet, forwarded IP headers remain deliberately untrusted; each public flow also has a generous global ceiling until Phase 0 records a provider-verified client identity.

**Why:** Public contact and signup limits are local Maps and use forwarded headers; custom 2FA/email-change sends have no application throttle (`src/server/routes/contact.ts`, `email-list.ts`, `account.ts`, `src/server/account/two-factor.ts`). Replicas or restarts make Map limits unreliable, and header spoofing depends on proxy behavior.

**What:** Enforce a shared budget for public writes and a per-account/per-destination cooldown for email-sending actions. Define separate thresholds for contact, list signup and 2FA/account email to avoid one flow starving another.

**How:** Prefer the deployed edge's rate-limit capability if it exposes a trusted client identity and covers all instances. If it cannot express the needed per-account/email rules, use a small durable database-backed counter or an already available shared service; do not add Redis solely by convention. Trust only the IP field documented in Phase 0, normalize it once, and keep Zod validation, origin/referrer checks and honeypots. Return `429` with a retry hint. Exercise two replicas, restarts, forged `x-forwarded-for`, a shared NAT IP, and parallel requests. Avoid storing raw email addresses in rate-limit keys or logs where a keyed digest suffices.

**Done when:** The same budget applies across instances, forged headers do not change identity, repeated sends are capped, and legitimate retries remain possible after the window.

## Phase 2 — consistent state transitions and delivery

### 2A. Consume tokens and update state atomically

**Status (2026-09-13): Complete for the identified workflows.** Email-change and email-list confirmation conditionally claim tokens inside transactions. 2FA email-code verification serializes attempt counting with a row lock, and setup/disable update the 2FA row and user flag transactionally. Concurrent and replay tests pass.

**Why:** The earlier implementation used separate read, update, and delete statements, allowing concurrent token use and inconsistent 2FA state.

**What:** Make each token consumption a single-use transaction. Update all related persistent rows in that same transaction, including the 2FA row and user flag. Keep duplicate clicks idempotent in the user-facing response.

**How:** For each workflow, use a Drizzle transaction that conditionally locks/claims one unexpired verification row, checks the expected action and user, applies the state update, and removes or marks the token consumed. A conditional `DELETE ... RETURNING` or row lock can supply the claim; failed-attempt increments need serialization or a conditional compare-and-update. Keep email delivery outside long DB transactions, with a retryable state if delivery fails. Add integration tests that issue two simultaneous valid submissions, simultaneous wrong codes, expired tokens, and a simulated failure between 2FA steps. Only add a schema index/constraint if these tests or query plans show it is required.

**Done when:** At most one request wins token consumption, attempt caps hold under concurrency, and 2FA auth rows cannot commit out of sync with the user flag.

### 2B. Define mail-delivery guarantees

**Status (2026-09-13): Complete for the application behavior currently required.** Security-sensitive account email-change, 2FA, and admin force-reset flows now expose explicit recovery or partial-failure outcomes when delivery fails. Public email-list signup compensates failed verification delivery without broad deletion, and required sends are awaited where the request depends on them. Welcome mail remains best-effort; no durable outbox is implemented because the plan treats that as conditional on a concrete SLA or incident history.

**Why:** Email-list rows commit before mail delivery and cleanup is best-effort; welcome mail is detached from the request with `void ...catch` (`src/server/routes/email-list.ts`, `src/lib/auth/index.ts`). This creates pending states with no message or messages that can be lost on invocation termination.

**What:** Classify each sender as required for completing the operation or best-effort. Make email-list signup retry safely reuse or replace a valid verification token without deleting another concurrent signup's state. Decide whether welcome mail needs a delivery guarantee.

**How:** Keep required Better Auth verification/reset sends awaited. Make public signup return a stable pending response and support resend within a cooldown; only remove a pending row if it still belongs to the failed attempt. If welcome mail is informational, document best-effort delivery and record failures. If measured provider failure or business requirements demand durable retries, add a small Postgres outbox plus one worker/cron consumer, with idempotent provider sends. Do not add a queue before that requirement exists.

**Done when:** A transient Resend failure has a clear retry path, concurrent signups cannot erase each other's pending state, and the delivery guarantee for each email type is documented.

## Phase 3 — bounded reads and intentional data lifecycle

### 3A. Paginate contact and subscriber admin views

**Status (2026-09-13): Partially complete.** Admin user listing is paginated with `limit` and `offset`, but the contact-submission and email-subscriber admin views named in this item still return all matching rows.

**Why:** Both DAL reads return all matching rows and the pages render them all (`src/server/db/dal/contact-submission.ts`, `email-list.ts`, corresponding `src/app/admin` pages). Message bodies and metadata increase payload size.

**What:** Introduce a fixed maximum page size, stable ordering and URL-preserved filters. Return `items` plus `hasMore` or a measured count. Keep bulk status actions explicitly scoped to the current filter, not accidentally to only the visible page.

**How:** Add `limit` and `offset` first for the existing admin UI, ordering by creation time plus ID. Fetch `limit + 1` for `hasMore` if exact counts are unnecessary. Keep contact message text out of list payloads if a detail view can load it on demand. Cap search length and reject or normalize pathological query strings. Test page boundaries, filter changes, row deletion between pages, and bulk action semantics. Consider keyset pagination only if deep offsets become a measured problem.

**Done when:** DB and serialized response work are bounded by page size for normal list views, while bulk actions retain their stated scope.

### 3B. Seed built-in email lists once

**Status (2026-09-13): Pending.** `ensureDefaultEmailLists()` still runs on foreground signup and admin email-list read paths, so this phase is not complete.

**Why:** `ensureDefaultEmailLists` upserts waitlist/newsletter on every signup and admin list read, and changes their status back to `active` (`src/server/db/dal/email-list.ts`). This couples requests to extra writes and defeats archiving.

**What:** Decide whether built-in lists may be archived. Move built-in row creation to a deliberate release/setup step and remove foreground upserts from read/signup functions.

**How:** Add an idempotent `db:seed` command or equivalent release task that runs after migrations; use insert-on-conflict behavior that does not overwrite admin status unless policy explicitly requires it. Add a smoke check that a fresh database has the two lists before accepting signup traffic. Deploy seed first, then remove the request-time calls. Do not hand-edit existing migration files.

**Done when:** Public signup performs no default-list write, a fresh environment is seeded predictably, and list status changes persist according to policy.

## Phase 4 — module boundaries, measurement and operations

### 4A. Make the dependency rule truthful

**Status (2026-09-13): Complete.** Admin account/session deletes and 2FA persistence moved to focused DAL modules, resolving the four violations recorded on 2026-09-12. Admin query contracts moved out of `src/components` into neutral modules, server data modules no longer depend on UI folders, and `pnpm depcruise` passes.

**Why:** The direct DB/schema imports conflicted with the repository's DAL-only policy. DAL imports of UI query types (`src/server/db/dal/admin-users.ts`, `contact-submission.ts`) also made the intended dependency direction unclear before the query contracts moved to neutral modules.

**What:** Keep a simple rule: HTTP/UI modules do not import Drizzle or the schema; DAL owns SQL, while focused workflow modules own business transitions. Put query-state contracts in a neutral server-safe module.

**How:** Move the admin account/session deletes to focused DAL functions. Place 2FA persistence and its transaction boundary in a focused DAL module while leaving code/TOTP policy in `src/server/account/two-factor.ts`. Move admin query types/parsers from `src/components/admin` to a neutral `src/lib`/`src/zod` contract as appropriate, then add one narrow dependency-cruiser rule for the direction you intend to enforce. Run `pnpm depcruise` in CI only after the baseline passes. Do not introduce generic repository classes or duplicate the Drizzle schema.

**Done when:** The four violations are gone, server data modules do not depend on UI folders, and the dependency check passes without broad exclusions.

### 4B. Measure before database or caching changes

**Status (2026-09-13): Pending.** There is no production p95/query-plan evidence, request-ID/metrics layer, connection budget, or deployment/backup/restore runbook yet.

**Why:** Admin user `ILIKE`, flexible sorts and `OFFSET`/`COUNT(*)` may become slow, but table sizes and p95 latency are unknown (`src/server/db/dal/admin-users.ts`, `SCALABILITY.md`). Session checks are repeated, but their actual request cost is unmeasured.

**What:** Establish p95 route latency, query duration/count, DB connection usage and email-send latency/failure metrics. Tune only slow paths. Record a production connection budget based on replicas × pool max (`src/server/db/index.ts`).

**How:** Add request IDs and structured errors around Elysia and Better Auth boundaries without logging tokens, secrets or full contact messages. Run `EXPLAIN ANALYZE` on representative filters with realistic rows. Add a targeted index or search change only when a query plan justifies it; reduce duplicate session reads if tracing shows material cost. If a host needs readiness, provide a separate bounded DB check; keep `/api/health` a clear liveness endpoint. Add a migration/backup/restore runbook and an observed deployment smoke test.

**Done when:** Slow paths have before/after measurements, DB connections stay within the service limit, and operators can distinguish app liveness from DB/provider readiness.

## Later, only if the trigger appears

| Aspect | Why/trigger | What and how |
|---|---|---|
| Avatar ownership | Product policy requires users to use only their own uploads or broken keys are common | Scope signed object keys by user or store upload ownership; verify at `src/lib/auth/hooks.ts` before accepting a profile image. Keep direct S3 transfer. |
| Search indexes/keyset pagination | Query plans show slow wildcard search or deep-page offsets | Add a narrowly targeted index or change search semantics; use keyset pagination for the specific large list. |
| Scheduled token cleanup | `verification` expiry deletion becomes a foreground latency/lock problem | Run bounded cleanup on a scheduled task; keep token validation at read time. |
| Durable email worker | Delivery loss/latency has a concrete SLA or material incident history | Add the Postgres outbox and one consumer; monitor retry and dead-letter state. |
| Read replicas/cache/sharding | Measured primary read/IO capacity cannot meet demand after query fixes | Choose the smallest capacity change supported by workload; do not infer it from total user count. |

## Leave alone

Keep the single Next.js deployable and existing Better Auth/Elysia split (`src/app/(backend)/api`), Drizzle with focused DAL functions (`src/server/db/dal`), local MDX for the small content set (`content/`, `src/lib/content-source.ts`), PostgreSQL-backed sessions, and signed direct-to-S3 avatar uploads (`src/lib/uploads`). No current evidence warrants microservices, a general DDD/Clean Architecture/repository framework, Redis for every read, or a queue for every email.
