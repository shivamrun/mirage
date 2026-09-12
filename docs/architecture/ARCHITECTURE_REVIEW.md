# Architecture review

**Current-state update (2026-09-13):** Phase 0 added focused integration tests and resolved the verified-admin API gap, non-atomic token transitions, and direct Drizzle dependency violations described in the 2026-09-12 baseline. Resolved findings remain below as an audit trail and are labeled accordingly.

## Verdict and scores

This is a coherent single-deployable starter, not an overengineered system. App Router routes, Better Auth, Elysia and Drizzle have recognizable roles; protected reads and mutations usually enforce authorization at the server. The largest risks are operational boundaries and state transitions, not missing architectural layers. Scores reflect repository evidence, not a live penetration or load test.

| Dimension | Score / 10 | Basis |
|---|---:|---|
| Maintainability | 7 | Clear feature folders and Zod contracts; some large mixed modules and reversed DAL-to-UI type dependencies. |
| Scalability | 5 | Direct S3 upload and bounded DB pools help; unbounded admin reads, per-request upserts and in-process limits do not. |
| Security | 7 | Verified-admin checks and atomic security transitions are covered by integration tests; process-local, caller-controlled rate-limit identity and unthrottled account email sends remain. |
| Developer experience | 7 | Local Compose, migrations, typed APIs, and focused Vitest coverage are present; local lint/build/dependency checks pass, while production operations remain undocumented. |
| Separation of concerns | 7 | Direct Drizzle imports moved behind focused DAL functions; email-list workflow and DAL-to-UI query-type dependencies remain. |

## Findings

### 1. Public rate limits do not hold across instances

**Problem:** Contact and email signup use process-local counters keyed only by a digest of the submitted email.

**Evidence / affected files:** `src/server/routes/contact.ts` and `src/server/routes/email-list.ts` define module-level `Map`s. `src/server/routes/public-rate-limit.ts` derives the key from the caller-supplied email. `src/proxy.ts` does not cover `/api`.

**Why it matters:** Changing the submitted email bypasses the current limit. Restarts and horizontal replicas also reset or partition it. A scripted client can supply origin/referrer headers, exposing DB writes and email delivery to abuse. A trustworthy client-IP source remains **Unknown / needs verification** until hosting is selected.

**Recommended change:** Enforce a rate limit at a trusted edge or use a small shared/durable limiter, derive client identity only from trusted proxy metadata, and include per-email throttles on email-sending paths. Keep the existing Zod/honeypot checks as secondary controls.

**Priority: High**

### 2. Email-code delivery has no application throttle

**Problem:** Authenticated users can repeatedly request enable/disable 2FA codes; account email-change/resend paths also lack application rate limits.

**Evidence / affected files:** `src/server/account/two-factor.ts` `sendAccountTwoFactorEmailCode` deletes old codes, creates a new row and calls `sendTwoFactorEmailCode` on each request. `src/server/routes/account.ts` has a TODO for rate limiting email delivery and email-change mutations. Better Auth may have its own limits for its own endpoints, but these custom Elysia paths do not show a shared limiter.

**Why it matters:** Repeated requests cause provider cost, mail flooding and contention; concurrently replacing codes can invalidate legitimate messages.

**Recommended change:** Add per-account and per-destination cooldowns and a global abuse ceiling at the same trusted boundary as public forms; return a stable retry response.

**Priority: High**

### 3. Admin API verified-email rule — resolved 2026-09-13

**Resolution:** Admin pages and both API families now require the admin role and a verified email.

**Evidence / affected files:** `src/server/routes/auth.ts` checks `authUser.emailVerified` in the Elysia admin macro. `src/app/(backend)/api/auth/[...all]/route.ts` rejects unverified admins for `/api/auth/admin/*`. `tests/admin-access.test.ts` covers visitors, users, unverified admins, and verified admins against representative reads and mutations.

**Result:** Unverified admins receive 403 from both custom Elysia admin endpoints and Better Auth admin endpoints. Non-admin concealment behavior remains unchanged.

**Follow-up:** Keep the representative authorization tests when adding either admin API family to another transport.

**Priority: Resolved**

### 4. Admin inboxes load all matching records

**Problem:** Contact and subscriber queries have no limit or pagination, and server pages pass complete results into tables.

**Evidence / affected files:** `src/server/db/dal/contact-submission.ts` `listContactSubmissions`, `src/server/db/dal/email-list.ts` `listEmailSubscribers`, `src/app/admin/contact-submission/all/page.tsx`, `src/app/admin/email-list/submissions/page.tsx`.

**Why it matters:** A sufficiently large inbox increases DB scan time, server memory, React serialization size and browser rendering cost. Contact rows include message bodies and subscriber rows include arbitrary metadata.

**Recommended change:** Add bounded server pagination, an explicit count or has-more result, and preserve filters/sorts in URLs. Cap bulk-status updates separately because they intentionally address many rows.

**Priority: High**

### 5. Token and 2FA state transitions — resolved 2026-09-13

**Resolution:** The identified email-change, email-list, and 2FA transitions now claim or lock state and update related rows transactionally.

**Evidence / affected files:** `src/server/db/dal/email-change.ts` conditionally deletes unexpired tokens inside the email update transactions. `src/server/db/dal/email-list.ts` uses `DELETE ... RETURNING` in the confirmation transaction. `src/server/db/dal/two-factor.ts` locks email codes and updates the 2FA row and user flag within transactions.

**Result:** Concurrent replay, wrong-attempt, and related-row consistency tests pass in `tests/email-change.test.ts`, `tests/public-forms.test.ts`, and `tests/two-factor.test.ts`.

**Follow-up:** Preserve these transaction boundaries and tests as the workflows evolve.

**Priority: Resolved**

### 6. Essential delivery and DB state are loosely coupled

**Problem:** Email-list subscription commits before its verification token/email send; cleanup on send error runs in later operations. Welcome email is fire-and-forget after user creation.

**Evidence / affected files:** `src/server/routes/email-list.ts`, `src/server/db/dal/email-list.ts`, `src/lib/auth/index.ts` `databaseHooks.user.create.after`, `src/server/email/send-email.tsx`.

**Why it matters:** Provider failure or process termination can leave a pending subscription with no usable mail, or lose a welcome email. Signup now keeps the pending row so a retry can issue another verification, and token-specific cleanup no longer deletes another request's pending state. Essential auth verification/password reset sends are awaited and should remain so.

**Recommended change:** Make signup retries idempotent and re-send a valid token safely. Await welcome email if it is essential; otherwise document it as best-effort. Add a Postgres outbox only if measured delivery requirements justify retries independent of requests.

**Priority: Medium**

### 7. Default email-list seeding happens during foreground requests

**Problem:** Built-in waitlist/newsletter rows are upserted during signup and list reads.

**Evidence / affected files:** `src/server/db/dal/email-list.ts` `ensureDefaultEmailLists` is called by `subscribeEmailToList`, `listEmailSubscribers` and `listActiveEmailLists`.

**Why it matters:** Every request performs extra writes and can contend on two rows. The upsert also restores built-in lists to `active`, so admin status changes to those lists do not persist.

**Recommended change:** Create/update defaults through a deliberate migration or deployment seed. Define whether built-ins may be archived, then remove request-time upserts.

**Priority: Medium**

### 8. DAL imports UI query contracts and business policy

**Problem:** Persistence modules depend on admin component query types, while email-list policy and token workflows live in the DAL.

**Evidence / affected files:** `src/server/db/dal/admin-users.ts` imports `@/components/admin/users/query`; `src/server/db/dal/contact-submission.ts` imports `@/components/admin/contact-submission`; `src/server/db/dal/email-list.ts` owns default list policy and token lifecycle. `.dependency-cruiser.js` has rules but does not enforce a general UI/server direction.

**Why it matters:** UI refactors can ripple into server queries and it is harder to test business transitions separately from SQL. This is a maintainability concern, not a reason for a full DDD/Clean Architecture conversion.

**Recommended change:** Move neutral query-state types/parsers to a shared contract module or server-owned module; extract only the email-list workflow policy into a focused `src/server/email-list` module as it changes. Keep straightforward query functions in the DAL.

**Priority: Medium**

### 9. Flexible search and counts will become expensive

**Problem:** Admin users use wildcard `ILIKE`, arbitrary sortable columns, `OFFSET` and exact count; contact and subscriber searches also use `%query%` across multiple fields.

**Evidence / affected files:** `src/server/db/dal/admin-users.ts`, `contact-submission.ts`, `email-list.ts`; schema indexes in `src/server/db/schema` cover keys/FKs and subscription list/status, not these general substring searches.

**Why it matters:** Existing btree indexes generally will not satisfy leading-wildcard searches; deep offset and repeated counts cost more as tables grow. Current row counts are **Unknown / needs verification**.

**Recommended change:** Bound search input and page size now; capture query plans at representative data sizes; add targeted indexes or adjust search behavior only for slow observed queries.

**Priority: Medium**

### 10. Avatar keys are syntax-validated, not tied to uploader identity

**Problem:** The profile image update hook accepts any syntactically valid `avatars/...` key; it does not prove the current user uploaded the object or that it exists.

**Evidence / affected files:** `src/lib/auth/hooks.ts` `parseImageUpdateValue`, `src/lib/uploads/keys.ts`, `src/server/routes/uploads.ts`, `src/components/account/account-profile-form.tsx`.

**Why it matters:** A user may point a profile at a different public avatar key or a missing object. This is primarily an integrity/ownership question; whether that is a security issue depends on product policy. Actual S3 ACL/CDN behavior is **Unknown / needs verification**.

**Recommended change:** If ownership matters, include user-scoped object keys or persist an upload record and verify ownership before profile update. Otherwise document public avatar reuse as allowed and validate existence if broken images matter.

**Priority: Low**

### 11. Dependency-rule violations — resolved 2026-09-13

**Resolution:** The modules that violated the DAL-only Drizzle rule now delegate persistence to focused DAL functions.

**Evidence / affected files:** `src/server/routes/admin/index.ts` delegates account/session deletes to `src/server/db/dal/admin-user-detail.ts`; `src/server/account/two-factor.ts` delegates persistence to `src/server/db/dal/two-factor.ts`. `pnpm depcruise` reports no violations as of 2026-09-13.

**Result:** The architectural rule matches the maintained imports and can act as a useful check again.

**Follow-up:** DAL-to-UI query-type imports are a separate remaining dependency-direction concern.

**Priority: Resolved**

### 12. Limited observability and production contract

**Problem:** The repository has console logs and a constant health endpoint but no visible structured request logs, metrics, tracing, alerting, CI, production deploy manifest, or backup/migration runbook.

**Evidence / affected files:** `src/server/routes/index.ts`, `src/server/email/send-email.tsx`, `src/server/routes/uploads.ts`, `package.json`, `docker-compose.yml`, and `README.md`. A dedicated test Compose file, Vitest harness, and 29 critical workflow tests now exist. On 2026-09-13, `pnpm test`, `pnpm lint`, `pnpm depcruise`, and `pnpm build` pass.

**Why it matters:** Latency, error rates and regressions will be difficult to measure before scaling or incident response. These may exist outside this repository: **Unknown / needs verification**.

**Recommended change:** Document the deployed runtime and migration/backup procedure; add request IDs, structured error logs and a small set of critical auth/email/database metrics. Add focused tests for security-sensitive transitions and deployment smoke checks.

**Priority: Medium**

## Strengths and target shape

Keep the Next monolith, Better Auth as auth authority, Elysia for application APIs, Drizzle/Postgres as the source of truth, local MDX for small editorial content, and direct-to-S3 upload (`src/app/(backend)/api`, `src/lib/auth`, `src/server/db`, `src/lib/content-source.ts`, `src/lib/uploads`). The target is the same deployable with cleaner contracts, bounded reads, atomic account transitions, reliable abuse control and measurable operations. No repository evidence justifies microservices, a general repository abstraction, Redis everywhere, or a queue by default.
