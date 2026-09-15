# Repository Architecture Audit

## Architecture overview

The repository is a Next.js App Router application with Elysia providing most
HTTP APIs. The dominant backend structure is:

```txt
Next route adapter -> Elysia route -> feature service -> DAL -> Drizzle schema
                                  -> shared email/rate-limit infrastructure
```

API and form validation is generally centralized under `src/zod`. Persistence
is centralized under `src/server/db`, with database access functions under
`src/server/db/dal`. Stateful account workflows live in feature modules such as
`src/server/account`, and cross-cutting HTTP behavior lives under
`src/server/http`. Email delivery is consistently centralized under
`src/server/email`.

That architecture is sound and does not need redesigning. The main deviations
are concentrated in the email-list DAL, admin security routes, contact and
admin page boundaries, and three competing approaches to admin query parsing.
There is also one correctness issue in the composition of rate-limit buckets.

The audit covered application TypeScript/TSX, database schemas and DALs,
validation schemas, route adapters, Elysia routes, feature services, shared
libraries, UI call sites, scripts, and tests. Generated/ignored output and
generated Drizzle migrations were treated as evidence of schema history, not
as refactor targets.

## Refactor Progress

Last updated: 2026-09-15

| ID | Area | Priority | Status | Notes |
| --- | --- | --- | --- | --- |
| A01 | Multi-bucket rate limits | P0 | Done | `consumeRateLimitPolicy` evaluates all buckets and increments them inside one transaction. |
| A02 | Email-list DAL/service boundary | P1 | Partial | Verification token/payload workflow moved to feature service; remaining admin CRUD/delete policy and signup result semantics still need cleanup. |
| A03 | Admin security service cleanup | P1 | Done | Linked-account and session revoke orchestration moved into `src/server/admin/security.ts`. |
| A04 | Contact service extraction | P1 | Done | Contact route now delegates honeypot, rate-limit, and creation workflow to `src/server/contact/service.ts`. |
| A05 | Account result mapping cleanup | P1 | Done | Account/admin-step-up services now return semantic error codes; shared Elysia mapper handles status/retry responses. |
| A06 | Stored verification payload schemas | P1 | Done | Internal Zod schemas now validate email-change, two-factor email-code, and email-list verification payloads. |
| A07 | Auth resolution consolidation | P1 | Done | Current-user/session resolution now has an explicit cache policy, with shared Elysia and Next admin access adapters. |
| A08 | Admin query contracts | P1 | Done | Admin query parsing/building now lives under `src/lib/admin`; component query files are compatibility re-exports and users UI filter config is presentation-owned. |
| A09 | Admin presentation/DAL coupling | P1 | Done | Admin pages consume feature-level `src/server/admin/*` read functions and user-detail components depend on view-model types instead of DAL types. |
| A10 | Upload validation contract | P1 | Done | Upload request/response contracts now live in `src/zod/uploads.ts`; route and client infer from the shared contract. |
| A11 | Unused auth-record schemas | P2 | Done | Unused auth-record Zod mirror was removed; Zod helpers now expose only active email normalization helpers. |
| A12 | Pagination helper cleanup | P2 | Done | Admin users now uses `totalCountWindow` in the DAL and `resolveOffsetPagination` in the admin users feature reader. |
| A13 | Shared admin formatters | P2 | Done | Cross-feature admin date/value formatters moved to `src/components/admin/shared/formatters.ts`; provider formatting remains user-detail-specific. |
| A14 | Contact-submission status validation | P1 | Done | Contact-submission status values and action/search parsing now share the canonical Zod contract in `src/zod/contact-submission.ts`. |

## [A01] Multi-bucket rate limits partially consume quota

**Severity:** High  
**Confidence:** High  
**Category:** DAL

**Current locations**

* `src/server/rate-limit.ts:26`
* `src/server/rate-limit.ts:58`
* `src/server/db/dal/rate-limit.ts:10`

**What is happening**

Both public-write and account-email policies are composed from two independent
calls to `consumeRateLimit`. Each DAL call immediately increments its bucket.
`consumePublicWriteLimit` increments the destination bucket before the global
bucket is checked. `consumeAccountEmailSendLimit` increments the account bucket
before the destination bucket is checked.

**Why this is a problem**

A request rejected by the second bucket has already spent quota from the first
bucket. For example, a destination-level rejection in an email flow still
consumes that account's only attempt for the cooldown window. A global public
limit rejection still consumes the caller's destination allowance. This makes
rate-limit behavior order-dependent and can cause avoidable denial of service
for legitimate follow-up requests. The transaction boundary belongs around
the policy's complete set of buckets, not each bucket individually.

**Evidence**

`consumeRateLimit` performs an `insert ... on conflict do update` immediately
at `src/server/db/dal/rate-limit.ts:21-54`. The public policy awaits one consume
at `src/server/rate-limit.ts:36-41` and then a second at `:50-55`. The account
policy does the same at `:72-80` and `:86-94`.

**Recommended structure**

```txt
src/server/rate-limit.ts
src/server/db/dal/rate-limit.ts
```

**Refactor**

Add a DAL operation that evaluates and consumes all buckets for a policy in one
database transaction (locking/upserting the keys in a stable order). Keep
policy names, hashing, limits, and messages in `src/server/rate-limit.ts`; keep
SQL and transaction mechanics in the DAL. Return the rejecting bucket's retry
time without persisting increments to unrelated buckets when the policy is
denied.

**Affected callers**

* `src/server/routes/contact.ts`
* `src/server/email-list/service.ts`
* `src/server/account/email-change.ts`
* `src/server/account/two-factor.ts`

---

## [A02] Email-list DAL owns token, workflow, and product policy

**Severity:** High  
**Confidence:** High  
**Category:** DAL

**Current locations**

* `src/server/db/dal/email-list.ts:35`
* `src/server/db/dal/email-list.ts:42`
* `src/server/db/dal/email-list.ts:70`
* `src/server/db/dal/email-list.ts:116`
* `src/server/db/dal/email-list.ts:308`
* `src/server/db/dal/email-list.ts:425`
* `src/server/db/dal/email-list.ts:466`
* `src/server/email-list/service.ts`

**What is happening**

The email-list DAL does more than persistence. It defines the default product
lists, decides that built-in lists cannot be deleted, generates verification
tokens, defines token expiry and identifier formats, serializes and manually
validates verification payloads, and performs the complete confirmation
workflow. Meanwhile, the existing email-list service owns only signup
orchestration and email delivery. The verification route bypasses that service
and calls the DAL workflow directly.

**Why this is a problem**

Business policy and workflow ownership are split between the DAL and service.
Changing verification rules or default-list policy requires editing database
code, and the workflow cannot be tested independently of persistence. The DAL
also exposes misleading result terminology: `subscribeEmailToList` returns a
top-level `status: "subscribed"` even when the returned subscription is
`pending`; the service must inspect the nested persistence record to infer the
actual domain outcome.

**Evidence**

* Token generation and expiry are defined at `email-list.ts:42-75`.
* Runtime payload parsing is implemented at `email-list.ts:78-99`.
* Built-in deletion policy is implemented at `email-list.ts:116-124` and
  enforced again in `deleteEmailList` at `:308-340`.
* `confirmEmailListVerification` validates, expires, consumes, and applies a
  subscription at `:466-521`.
* `src/server/routes/email-list.ts:72` invokes that DAL workflow directly even
  though `src/server/email-list/service.ts` already exists.

**Recommended structure**

```txt
src/server/email-list/config.ts
src/server/email-list/service.ts
src/server/email-list/verification.ts
src/server/db/dal/email-list.ts
```

**Refactor**

Move default-list policy, token format/expiry, verification payload handling,
and confirmation orchestration into the email-list feature. Leave atomic
queries and transactions in the DAL. Make the service return semantic outcomes
such as `pending-verification`, `subscribed`, `unknown-list`, and `protected`.
Have both signup and verification routes call the service. Keep the atomic
consume-and-subscribe transaction in the DAL, but pass it already validated
domain data.

**Affected callers**

* `src/server/email-list/service.ts`
* `src/server/routes/email-list.ts`
* `src/server/routes/admin/email-list.ts`
* `src/app/admin/email-list/all/page.tsx`
* `src/app/admin/email-list/submissions/page.tsx`
* `scripts/seed.ts`

---

## [A03] Admin account/session workflows are assembled in the HTTP route

**Severity:** High  
**Confidence:** High  
**Category:** Layer Violation

**Current locations**

* `src/server/routes/admin/user-security.ts:34`
* `src/server/routes/admin/user-security.ts:104`
* `src/server/admin/security.ts`
* `src/server/db/dal/admin-user-detail.ts:69`

**What is happening**

The admin security route fetches persistence records, evaluates authorization,
calls a second DAL mutation, and, for sessions, invokes Better Auth directly.
The same route file also delegates password-reset and global-session workflows
to `src/server/admin/security.ts`, so one feature uses both route-owned and
service-owned workflows.

The linked-account path performs a preflight read and authorization decision,
then calls a transactional DAL function that repeats the read and sign-in
method checks. The session path reads a token from the DAL and passes it to
`auth.api.revokeUserSession` in the route.

**Why this is a problem**

Security-sensitive invariants are distributed across HTTP, policy, provider,
and DAL code. The linked-account preflight can become stale before the
transaction and is redundant because the DAL correctly rechecks the invariant.
The route must understand persistence-only account rows and provider session
tokens. Similar operations in the same file cannot share an application-level
contract or be reused outside Elysia.

**Evidence**

* Linked-account preflight and policy evaluation occur at
  `user-security.ts:40-64`; deletion is a separate call at `:66-69`.
* `deleteAdminLinkedAccount` repeats the account and remaining-method reads
  under a transaction/advisory lock at
  `src/server/db/dal/admin-user-detail.ts:106-154`.
* Session lookup and direct provider revocation occur at
  `user-security.ts:108-134`.
* The same route delegates `forcePasswordReset` and `revokeEverySession` to
  `src/server/admin/security.ts` at `user-security.ts:158` and `:197`.

**Recommended structure**

```txt
src/server/admin/security.ts
src/server/db/dal/admin-user-detail.ts
src/server/routes/admin/user-security.ts
```

**Refactor**

Move unlink-account and revoke-session orchestration into the existing admin
security service. Let the transactional DAL return semantic outcomes and the
final safe DTO; evaluate actor policy in the service, and keep Elysia status
mapping in the route. Remove the non-authoritative linked-account preflight or
replace it with a single transactional DAL command whose result the service
authorizes/maps.

**Affected callers**

* `src/components/admin/user-detail/dialogs/account-management-dialog.tsx`
* `src/components/admin/user-detail/dialogs/session-management-dialog.tsx`
* `tests/admin-deletion.test.ts`
* `tests/phase-zero-auth-policy.test.ts`

---

## [A04] Contact submission duplicates the email-list service workflow in a route

**Severity:** Medium  
**Confidence:** High  
**Category:** Service

**Current locations**

* `src/server/routes/contact.ts:16`
* `src/server/email-list/service.ts:37`
* `src/server/db/dal/contact-submission.ts:60`

**What is happening**

The contact route performs honeypot handling, selects a rate-limit policy,
maps rate-limit failure, and writes through the DAL. The closely related public
email-list form puts the same honeypot/rate-limit/orchestration sequence in a
feature service and leaves its route to map the result.

**Why this is a problem**

Public-form abuse policy has two owners. Adding logging, notification, audit,
or alternate entry points to contact submissions would require reconstructing
HTTP route behavior. The inconsistency is meaningful because these workflows
share the same public rate-limit infrastructure and trust boundary.

**Evidence**

`src/server/routes/contact.ts:17-32` contains the whole workflow. The equivalent
email-list steps live at `src/server/email-list/service.ts:40-55`, with the
route only handling semantic results at `src/server/routes/email-list.ts:25-53`.

**Recommended structure**

```txt
src/server/contact/service.ts
src/server/db/dal/contact-submission.ts
src/server/routes/contact.ts
```

**Refactor**

Extract `submitContactForm` to a contact feature service. Keep the honeypot,
rate-limit selection, and create orchestration there; keep HTTP status/header
mapping in the route and the insert in the DAL. Do not introduce a generic
"public form" framework—the shared rate limiter is already the useful common
abstraction.

**Affected callers**

* `src/components/contact/contact-form.tsx`
* `tests/public-forms.test.ts`
* `tests/route-contract.test.ts`

---

## [A05] Feature services expose HTTP status codes and routes repeat result mapping

**Severity:** Medium  
**Confidence:** High  
**Category:** HTTP

**Current locations**

* `src/server/account/email-change.ts:44`
* `src/server/account/two-factor.ts:39`
* `src/server/auth/admin-step-up.ts:22`
* `src/server/routes/account.ts:95`

**What is happening**

Account services return `statusCode` and `retryAfterSeconds` as part of domain
results. The account route repeats almost the same blocks to copy `Retry-After`
and turn service errors into Elysia `status(...)` responses. Some handlers use
the returned status generically, while others enumerate 400/409/503 and fall
back to 400.

**Why this is a problem**

The services are coupled to one transport's status model, yet the route still
duplicates the mapping. New error cases can be accidentally downgraded to 400
in one handler or omitted from a response schema. This is already visible in
the different mapping shapes across the same route file.

**Evidence**

* Service unions contain HTTP codes at `email-change.ts:44-50`,
  `two-factor.ts:39-47`, and `admin-step-up.ts:22-34`.
* Retry/error mapping is repeated in `account.ts:103-109`, `:134-147`,
  `:175-182`, `:212-219`, `:249-256`, `:387-400`, `:430-440`, `:469-479`,
  and `:507-520`.
* Some blocks return `status(result.statusCode, ...)`; others hard-code a
  subset and use 400 for everything else.

**Recommended structure**

```txt
src/server/account/results.ts
src/server/http/result-response.ts
src/server/routes/account.ts
```

**Refactor**

Give application results stable semantic codes (for example `invalid-code`,
`conflict`, `rate-limited`, `delivery-failed`). Add one narrow Elysia adapter
for the common message/retry response shape, or a local account-route helper if
it is not reused elsewhere. Keep response schema declarations explicit on each
route. Do not make the service construct `Response` objects.

**Affected callers**

* `src/server/routes/account.ts`
* `src/components/account/account-email-manager.tsx`
* `src/components/account/account-two-factor-form.tsx`
* `src/components/auth/two-factor-form.tsx`

---

## [A06] Persisted verification payloads use three manual validation contracts

**Severity:** Medium  
**Confidence:** High  
**Category:** Validation

**Current locations**

* `src/server/account/email-change.ts:26`
* `src/server/account/email-change.ts:94`
* `src/server/db/dal/email-list.ts:35`
* `src/server/db/dal/email-list.ts:78`
* `src/server/account/two-factor.ts:49`
* `src/server/db/dal/two-factor.ts:12`

**What is happening**

Three workflows store JSON in Better Auth's `verification.value` column. Each
defines a TypeScript type near the writer and separately performs hand-written
`JSON.parse` and `typeof` validation near a reader. The two-factor writer type
is in the service while its parser is in the DAL. The email-list type and parser
are both in the DAL. The email-change type and parser are in the service.

**Why this is a problem**

Compile-time types do not validate stored or legacy data. Writer and reader
contracts can drift, as can migration/legacy behavior. The repository already
uses Zod as its validation convention, but these untrusted persisted payloads
do not use it. This does not mean API schemas and database schemas should be
merged; these are internal persistence-boundary schemas with their own trust
requirements.

**Evidence**

* `parsePendingEmailChange` manually checks four string fields at
  `email-change.ts:94-115`.
* `parseEmailListVerificationPayload` repeats the same pattern at
  `email-list.ts:78-99`.
* `parseEmailCodeValue` implements a third parser and legacy fallback at
  `two-factor.ts:12-33`, while `EmailCodeValue` and serialization are in
  `src/server/account/two-factor.ts:49-52` and `:174-181`.

**Recommended structure**

```txt
src/server/account/verification-schemas.ts
src/server/email-list/verification.ts
```

**Refactor**

Define one schema beside each feature workflow and use it for both serialization
types and safe parsing. Keep the intentional legacy fallback for old
two-factor values as an explicit schema union/adapter. Do not export these
internal payload schemas from the public `src/zod/index.ts` barrel.

**Affected callers**

* `src/server/account/email-change.ts`
* `src/server/account/two-factor.ts`
* `src/server/db/dal/two-factor.ts`
* `src/server/email-list/service.ts`
* `src/server/routes/email-list.ts`

---

## [A07] Authentication resolution has multiple transport-specific entry points

**Severity:** Medium  
**Confidence:** High  
**Category:** Architecture

**Current locations**

* `src/server/http/auth.ts:20`
* `src/lib/auth/current-user.ts:38`
* `src/lib/auth/access.ts:31`
* `src/components/auth/verified-role-gate.tsx:41`
* `src/app/(backend)/api/auth/[...all]/route.ts:10`
* `src/app/(backend)/api/admin/metrics/route.ts:6`

**What is happening**

Session/current-user/admin-access resolution is rebuilt for Elysia macros,
Next server components, the Better Auth catch-all adapter, and the metrics
route. `src/server/http/auth.ts` has its own `resolveAuthSession` (including
`disableCookieCache: true`), while `src/lib/auth/current-user.ts` calls
`auth.api.getSession` without that option. Both Next route handlers manually
resolve the current user, evaluate admin access, and build JSON denials.

**Why this is a problem**

Different entry points can observe different cache behavior and can drift on
which admin checks are required or how denials are represented. The policy
functions are already centralized; resolution and transport adaptation are the
remaining duplicated pieces. The server-rendered gate has legitimate UI
behavior and should remain a component, but it should consume the same resolved
access decision.

**Evidence**

* Elysia session resolution: `src/server/http/auth.ts:20-26`.
* Current-user session resolution: `src/lib/auth/current-user.ts:38-49`.
* Elysia repeats session/current-user resolution in four macro resolvers at
  `src/server/http/auth.ts:34-114`.
* Both Next handlers repeat `getCurrentUser` plus `evaluateAdminAccess` at
  `api/auth/[...all]/route.ts:14-27` and `api/admin/metrics/route.ts:7-16`.
* The RSC gate separately performs role/email/2FA/assurance sequencing at
  `verified-role-gate.tsx:55-116`.

**Recommended structure**

```txt
src/lib/auth/current-user.ts
src/lib/auth/admin-access.ts
src/server/http/auth.ts
src/server/http/next-auth.ts
```

**Refactor**

Create one server-only current-user resolver with an explicit cache policy and
one helper that turns an `AuthPolicyDecision` into a Next `Response`. Reuse it
from both Next route handlers. In Elysia, factor the repeated session/user
resolution into a shared internal resolver used by the macros. Keep Elysia
macros and the RSC gate as transport/UI adapters rather than trying to merge
them into one abstraction.

**Affected callers**

* `src/server/routes/admin/index.ts`
* `src/app/admin/layout.tsx`
* `src/app/(backend)/api/auth/[...all]/route.ts`
* `src/app/(backend)/api/admin/metrics/route.ts`
* `src/lib/auth/access.ts`

---

## [A08] Admin query contracts are split across three competing patterns

**Severity:** Medium  
**Confidence:** High  
**Category:** DRY

**Current locations**

* `src/lib/admin/users-query.ts`
* `src/components/admin/users/query.ts`
* `src/lib/admin/contact-submission-query.ts`
* `src/components/admin/contact-submission/query.ts`
* `src/components/admin/email-list/query.ts`
* `src/zod/contact.ts:160`

**What is happening**

Admin users, contact submissions, and email subscribers each define URL query
contracts differently. Users use a 508-line shared module containing transport
parsing, DAL-facing state, DTOs, and UI labels/placeholders, plus a component
module for URL construction. Contact submissions split parsing/types into
`src/lib` and URL construction into `src/components`. Email subscribers put
both parsing and URL construction inside `src/components` but source validation
from Zod.

All three independently implement `string | string[] | undefined` extraction.
Users and contact submissions also independently serialize raw search params;
several feature files independently read strings from `FormData`.

**Why this is a problem**

DAL code imports query-state types from a module that also owns UI labels and
input placeholders. Server pages/actions import non-visual query behavior from
component directories. Adding pagination or canonical URL behavior to another
admin list requires choosing among three conventions. This is conceptual
duplication, not merely repeated three-line helpers.

**Evidence**

* `src/server/db/dal/admin-users.ts:21-28` imports DAL contracts from the
  UI-heavy `src/lib/admin/users-query.ts` module.
* `src/server/db/dal/contact-submission.ts:3-6` imports another query contract
  from `src/lib/admin`.
* `src/app/admin/email-list/submissions/page.tsx:3-7` imports its parser from
  `src/components/admin`.
* Scalar extraction appears at `users-query.ts:296`,
  `contact-submission-query.ts:36`, and
  `components/admin/email-list/query.ts:15`.
* Raw URL serialization is duplicated at
  `components/admin/users/query.ts:162-175` and
  `components/admin/contact-submission/query.ts:53-68`.

**Recommended structure**

```txt
src/lib/admin/query-params.ts
src/lib/admin/users-query.ts
src/lib/admin/contact-submission-query.ts
src/lib/admin/email-list-query.ts
src/components/admin/users/filter-config.ts
```

**Refactor**

Standardize feature query modules under `src/lib/admin`. Extract only the truly
shared transport primitives (`firstParamValue`, raw serialization, and perhaps
`formString`). Move UI labels/placeholders out of the DAL-facing users contract
into the users component feature. Keep each feature's allowed fields/operators
specific; do not build a generic filtering framework.

**Affected callers**

* `src/server/db/dal/admin-users.ts`
* `src/server/db/dal/contact-submission.ts`
* `src/server/db/dal/email-list.ts`
* `src/app/admin/users/page.tsx`
* `src/app/admin/contact-submission/all/page.tsx`
* `src/app/admin/contact-submission/all/actions.ts`
* `src/app/admin/email-list/submissions/page.tsx`
* Admin list toolbar, filter, and pagination components

---

## [A09] Admin presentation is coupled to DAL return types and direct data access

**Severity:** Medium  
**Confidence:** High  
**Category:** Layer Violation

**Current locations**

* `src/components/admin/user-detail/view.tsx:1`
* `src/components/admin/user-detail/header.tsx:8`
* `src/components/admin/user-detail/overview.tsx:9`
* `src/components/admin/user-detail/activity-tabs.tsx:3`
* `src/app/admin/users/[userId]/admin-user-detail-page.tsx:9`
* `src/app/admin/users/page.tsx:18`
* `src/app/admin/email-list/all/page.tsx:6`
* `src/app/admin/email-list/submissions/page.tsx:10`
* `src/app/admin/security/controls/page.tsx:7`

**What is happening**

Four presentation components import `AdminUserDetail` directly from a DAL
file. Admin pages also query DALs directly and pass their results straight into
components. This differs from account routes, email-list signup, and admin
security mutations, which expose feature/application functions above the DAL.

**Why this is a problem**

UI props are defined by a persistence function's inferred return type. A query
selection or table-shape refactor therefore propagates directly into the
component layer, and server pages have no stable place for serialization,
redaction, or view-model composition. Simple server-component reads do not
automatically require a service, but the user-detail shape is reused broadly
enough to justify a feature-owned contract.

**Evidence**

`AdminUserDetail` is inferred from `getAdminUserDetail` at
`src/server/db/dal/admin-user-detail.ts:65-67` and imported by four component
files. Five admin page families import DAL functions directly, while
`src/server/admin/security.ts` demonstrates the existing feature-service
convention for admin workflows.

**Recommended structure**

```txt
src/server/admin/user-detail.ts
src/server/admin/users.ts
src/server/admin/email-list.ts
src/server/db/dal/admin-user-detail.ts
```

**Refactor**

Introduce feature-owned read functions/DTOs for the reused admin user-detail
view and security summary. Pages should consume those stable shapes. Keep
trivial one-off reads direct if no transformation, policy, or reuse is gained;
the goal is to stop components importing persistence-layer types, not to add a
service wrapper around every query.

**Affected callers**

* `src/components/admin/user-detail/view.tsx`
* `src/components/admin/user-detail/header.tsx`
* `src/components/admin/user-detail/overview.tsx`
* `src/components/admin/user-detail/activity-tabs.tsx`
* Admin users, email-list, contact-submission, and security pages

---

## [A10] Upload validation is inline and duplicates its client contract

**Severity:** Medium  
**Confidence:** High  
**Category:** Validation

**Current locations**

* `src/server/routes/uploads.ts:12`
* `src/server/routes/uploads.ts:16`
* `src/server/routes/uploads.ts:72`
* `src/lib/uploads/avatar.ts:5`
* `src/lib/uploads/server/assets.ts:7`

**What is happening**

The upload route defines request and response schemas inline using TypeBox,
while the rest of the API contract is centralized under `src/zod`. The client
separately declares `PrepareAvatarUploadResponse`, and accepted asset keys/MIME
types are represented again in server asset configuration.

**Why this is a problem**

The upload API's runtime schema and client TypeScript type can drift. Adding a
new upload asset requires synchronized edits to route enums, server assets, and
possibly the client. The inline error response schemas also duplicate the
central message response shape.

**Evidence**

* Route-local asset enum and response schema: `uploads.ts:12-24`.
* Route-local request and response contracts: `uploads.ts:72-103`.
* Separate client response type: `src/lib/uploads/avatar.ts:5-9`.
* Canonical server asset keys and MIME limits already exist at
  `src/lib/uploads/server/assets.ts:7-34`.

**Recommended structure**

```txt
src/zod/uploads.ts
src/lib/uploads/contracts.ts
src/lib/uploads/server/assets.ts
src/server/routes/uploads.ts
```

**Refactor**

Define a single upload request/response contract in the established validation
layer and infer the client response type from it. Derive the route's asset-key
validation from `uploadAssetKeys`. Keep SDK-specific error discrimination in
the route and storage limits in the server asset configuration.

**Affected callers**

* `src/lib/uploads/avatar.ts`
* `src/components/account/account-profile-form.tsx`
* `src/server/routes/uploads.ts`

---

## [A11] Unused Zod auth-record schemas mirror the Drizzle schema

**Severity:** Low  
**Confidence:** High  
**Category:** Architecture

**Current locations**

* `src/zod/auth-schema.ts`
* `src/zod/helpers/base-column.ts:29`
* `src/zod/index.ts:6`
* `src/server/db/schema/auth-schema.ts`

**What is happening**

`src/zod/auth-schema.ts` manually mirrors the Better Auth Drizzle tables,
including relations and database defaults. It is exported from the main Zod
barrel, but no application or test caller uses these record schemas or inferred
types. The Zod `idColumn`, timestamp, and moderation helpers exist mainly to
support this mirrored model; only the email normalization schema has active
API/form callers.

**Why this is a problem**

There are two competing declarations of the persisted auth shape, but only the
Drizzle schema is authoritative. The unused mirror can silently drift on
nullability/defaults and makes public input schemas appear interchangeable with
trusted database records. It also broadens the client-reachable Zod barrel with
persistence-oriented contracts.

**Evidence**

The complete mirror is at `src/zod/auth-schema.ts:15-108`; the authoritative
tables are at `src/server/db/schema/auth-schema.ts:13-154`. Repository-wide
caller search finds no use of `userWithRelations`, `sessionWithRelations`,
`accountWithRelations`, `twoFactorWithRelations`, or their inferred record
types outside their declaration/export.

**Recommended structure**

```txt
src/zod/auth-forms.ts
src/zod/helpers/email.ts
src/server/db/schema/auth-schema.ts
```

**Refactor**

Delete the unused auth-record mirror and stop exporting it from
`src/zod/index.ts`. Retain the actively used email normalization schema in a
narrowly named validation helper. If a database-to-domain validation boundary
is later required, derive or define only the exact DTO at that boundary rather
than recreating every table and relation.

**Affected callers**

* `src/zod/index.ts`
* `src/zod/auth-forms.ts`
* `src/zod/contact.ts`

---

## [A12] Pagination helper is dead while pagination is reimplemented manually

**Severity:** Low  
**Confidence:** High  
**Category:** DRY

**Current locations**

* `src/server/db/helpers/paginate.ts`
* `src/server/db/dal/admin-users.ts:244`
* `src/app/admin/users/page.tsx:35`

**What is happening**

The repository has `totalCountWindow` and `resolveOffsetPagination`, but neither
is called. Admin users instead runs a separate count and data query, calculates
offset and total pages in the page component, and redirects out-of-range pages
there.

**Why this is a problem**

There are two pagination designs: an unused advertised helper and a live manual
implementation. Future list features cannot tell which is canonical. The
separate count/data query can also observe different snapshots under concurrent
writes, although that is a lower-risk consistency concern for this admin list.

**Evidence**

Repository-wide caller search finds the helper names only inside
`src/server/db/helpers/paginate.ts`. Manual offset and page calculations occur
at `src/app/admin/users/page.tsx:35` and `:52-63`; the separate queries occur at
`src/server/db/dal/admin-users.ts:252-266`.

**Recommended structure**

```txt
src/server/db/helpers/paginate.ts
src/server/db/dal/admin-users.ts
src/server/admin/users.ts
```

**Refactor**

Choose one approach. Prefer adopting the existing window-count helper in the
DAL and the existing offset resolver in an admin users feature function, with
an explicit empty-page fallback because a window count is absent when no rows
are returned. If that edge-case complexity is not worthwhile, delete the dead
helper and document the two-query approach as canonical.

**Affected callers**

* `src/app/admin/users/page.tsx`
* `src/components/admin/users/pagination.tsx`
* `src/server/db/dal/admin-users.ts`

---

## [A13] Shared admin formatting is buried under user-detail

**Severity:** Low  
**Confidence:** High  
**Category:** Misplaced Code

**Current locations**

* `src/components/admin/user-detail/formatters.ts`
* `src/components/admin/contact-submission/table.tsx:38`
* `src/components/admin/email-list/admin-email-list-panel.tsx:5`
* `src/components/admin/users/table.tsx:24`

**What is happening**

Generic date conversion/formatting and value formatting live inside the
`user-detail` feature, but users, email lists, and contact submissions import
them from there. Provider-name formatting in the same file is genuinely
user/account-specific.

**Why this is a problem**

Unrelated admin features depend on the user-detail folder for generic display
infrastructure. That reverses feature ownership and makes the current location
look more reusable than all of its contents really are.

**Evidence**

`formatDate`, `toDate`, and `isFutureDate` are defined at
`user-detail/formatters.ts:8-28`. They are imported by admin users, email-list,
and contact-submission components. `formatProviderName` at `:30-38` is used by
account-management UI and should remain feature-specific.

**Recommended structure**

```txt
src/components/admin/shared/formatters.ts
src/components/admin/user-detail/formatters.ts
```

**Refactor**

Move date/value formatting used across admin features to `admin/shared`.
Retain provider/account-specific formatting under `user-detail`. Do not merge
the distinct public-content date formatting in
`src/components/content/content-meta.tsx`; its locale and output semantics are
different.

**Affected callers**

* `src/components/admin/contact-submission/table.tsx`
* `src/components/admin/email-list/admin-email-list-panel.tsx`
* `src/components/admin/users/table.tsx`
* `src/components/admin/user-detail/activity-tabs.tsx`
* `src/components/admin/user-detail/overview.tsx`

---

## [A14] Contact-submission status validation has three sources of truth

**Severity:** Medium  
**Confidence:** High  
**Category:** Validation

**Current locations**

* `src/server/db/schema/contact-submission.ts:12`
* `src/lib/admin/contact-submission-query.ts:11`
* `src/app/admin/contact-submission/all/actions.ts:17`

**What is happening**

The same `new | read | archived` status set is declared as a Drizzle enum, a
hand-written TypeScript union, and a local runtime `Set`. Server actions parse
`FormData` manually and silently return on invalid IDs/statuses, unlike the
repository's Zod-backed Elysia request validation.

**Why this is a problem**

Changing a status requires synchronized edits, and the runtime validator can
drift from both the TypeScript and database contracts. Silent invalid-action
returns also make malformed submissions indistinguishable from successful
no-ops to callers and tests.

**Evidence**

The database values are at `contact-submission.ts:12-16`, the union at
`contact-submission-query.ts:11`, and the local set/parser at
`actions.ts:17-40`. Both actions return without a typed outcome at
`actions.ts:57-59` and `:72-74`.

**Recommended structure**

```txt
src/zod/contact-submission.ts
src/lib/admin/contact-submission-query.ts
src/app/admin/contact-submission/all/actions.ts
```

**Refactor**

Define a canonical runtime status schema in the validation layer and infer the
TypeScript type from it. Add action input schemas derived from that status
schema, including non-empty IDs and the query-state fields. Parse once at the
server-action boundary and return or throw an explicit typed failure.

**Affected callers**

* `src/app/admin/contact-submission/all/actions.ts`
* `src/components/admin/contact-submission/table.tsx`
* `src/components/admin/contact-submission/toolbar.tsx`
* `src/server/db/dal/contact-submission.ts`
* `tests/admin-actions.test.ts`

## Repeated Patterns

```txt
Account HTTP result mapping
├── src/server/routes/account.ts:103
├── src/server/routes/account.ts:134
├── src/server/routes/account.ts:175
├── src/server/routes/account.ts:212
├── src/server/routes/account.ts:249
├── src/server/routes/account.ts:387
├── src/server/routes/account.ts:430
├── src/server/routes/account.ts:469
└── src/server/routes/account.ts:507

Current-user/admin access resolution
├── src/server/http/auth.ts
├── src/lib/auth/current-user.ts
├── src/components/auth/verified-role-gate.tsx
├── src/app/(backend)/api/auth/[...all]/route.ts
└── src/app/(backend)/api/admin/metrics/route.ts

Persisted verification JSON parsing
├── src/server/account/email-change.ts
├── src/server/db/dal/email-list.ts
└── src/server/db/dal/two-factor.ts

Admin search-param scalar extraction
├── src/lib/admin/users-query.ts
├── src/lib/admin/contact-submission-query.ts
└── src/components/admin/email-list/query.ts

Admin raw/canonical URL construction
├── src/components/admin/users/query.ts
├── src/components/admin/contact-submission/query.ts
└── src/components/admin/email-list/query.ts

FormData string extraction
├── src/app/admin/contact-submission/all/actions.ts
├── src/components/admin/users/query.ts
├── src/components/admin/email-list/email-list-create-dialog.tsx
└── src/components/admin/email-list/list-row-actions.tsx

Admin date/value formatting
├── src/components/admin/user-detail/formatters.ts
├── src/components/admin/shared/user-display.tsx
└── src/components/account/account-connected-accounts.tsx

Direct admin page-to-DAL reads
├── src/app/admin/users/page.tsx
├── src/app/admin/users/[userId]/admin-user-detail-page.tsx
├── src/app/admin/contact-submission/all/page.tsx
├── src/app/admin/email-list/all/page.tsx
├── src/app/admin/email-list/submissions/page.tsx
└── src/app/admin/security/controls/page.tsx
```

The account and public-content date formatters intentionally produce different
display formats; only the admin date formatter imports are candidates for
merging.

## Architecture Boundary Violations

```txt
Route -> Database directly
├── contact submission creation
├── email-list verification
├── admin email-list CRUD
└── admin linked-account/session lookup and mutation

DAL -> Business policy/workflow
├── built-in email-list deletion policy
├── email-list verification token lifecycle
└── email-list confirmation workflow

Service -> HTTP concepts
├── account email-change statusCode results
├── account two-factor statusCode results
└── admin step-up statusCode results

Component -> DAL type
└── admin user-detail component family -> AdminUserDetail

Feature -> Generic presentation helper
├── contact submissions -> user-detail/formatters
├── email lists -> user-detail/formatters
└── users table -> user-detail/formatters

DAL -> UI-heavy query contract
└── admin-users DAL -> lib/admin/users-query UI configuration

Route -> Inline validation contract
└── uploads route -> route-local TypeBox request/response schemas
```

## Proposed Target Structure

Only relevant portions are shown; existing folders not listed should remain as
they are.

```txt
src/
├── app/
│   └── admin/
│       └── contact-submission/all/
│           └── actions.ts                 # boundary only; validate/delegate
├── components/
│   └── admin/
│       ├── shared/
│       │   ├── formatters.ts
│       │   └── user-display.tsx
│       └── users/
│           └── filter-config.ts           # labels/placeholders/UI options
├── lib/
│   ├── admin/
│   │   ├── query-params.ts                # small transport primitives
│   │   ├── users-query.ts                 # feature query contract/parser
│   │   ├── contact-submission-query.ts
│   │   └── email-list-query.ts
│   └── auth/
│       ├── current-user.ts                # one server-only resolver
│       └── admin-access.ts                # transport-neutral policy
├── server/
│   ├── account/
│   │   ├── email-change.ts
│   │   ├── results.ts
│   │   ├── two-factor.ts
│   │   └── verification-schemas.ts
│   ├── admin/
│   │   ├── security.ts
│   │   ├── user-detail.ts
│   │   └── users.ts
│   ├── contact/
│   │   └── service.ts
│   ├── email-list/
│   │   ├── config.ts
│   │   ├── service.ts
│   │   └── verification.ts
│   ├── http/
│   │   ├── auth.ts
│   │   ├── next-auth.ts
│   │   ├── request-policy.ts
│   │   └── result-response.ts
│   └── db/
│       └── dal/                           # persistence and atomic operations
└── zod/
    ├── account-api.ts
    ├── admin-api.ts
    ├── contact-submission.ts
    ├── contact.ts
    ├── uploads.ts
    └── helpers/
        └── email.ts
```

## Refactor Priority

### P0 — Fix first

* **A01:** Make multi-bucket rate-limit evaluation atomic so denied requests do
  not spend unrelated quota.

### P1 — Worth refactoring

* **A02:** Move email-list policy and verification workflow out of the DAL.
* **A03:** Move admin account/session orchestration out of the route.
* **A04:** Add the missing contact feature service.
* **A05:** Replace HTTP-coded service results and repeated account-route mapping.
* **A06:** Validate stored verification payloads with feature-owned schemas.
* **A07:** Consolidate current-user resolution and Next admin denial adapters.
* **A08:** Standardize admin query contracts and separate UI filter config.
* **A09:** Stop admin components depending on DAL-inferred return types.
* **A10:** Centralize upload request/response validation.
* **A14:** Establish one runtime contact-submission status contract.

### P2 — Cleanup

* **A11:** Delete the unused Zod mirror of auth database records.
* **A12:** Adopt or delete the unused pagination abstraction.
* **A13:** Move cross-feature admin formatters to `admin/shared`.

## Top 10 Refactors

1. **Make rate-limit policy consumption atomic**  
   From: `src/server/rate-limit.ts`, `src/server/db/dal/rate-limit.ts`  
   To: a multi-bucket transactional DAL command used by the existing policy service  
   Removes duplication from: public-write and account-email limit sequences  
   Risk: Medium  
   Value: High

2. **Extract email-list verification and policy from the DAL**  
   From: `src/server/db/dal/email-list.ts`  
   To: `src/server/email-list/verification.ts`, `src/server/email-list/config.ts`, and the existing service  
   Removes duplication from: route/DAL service bypass and manual workflow outcomes  
   Risk: Medium  
   Value: High

3. **Move admin account/session commands into the admin security service**  
   From: `src/server/routes/admin/user-security.ts`  
   To: `src/server/admin/security.ts`  
   Removes duplication from: linked-account preflight and transactional checks  
   Risk: Medium  
   Value: High

4. **Create one account result-to-Elysia adapter**  
   From: repeated blocks in `src/server/routes/account.ts`  
   To: `src/server/http/result-response.ts` or a local account route helper  
   Removes duplication from: nine account handlers  
   Risk: Low  
   Value: High

5. **Use feature-owned schemas for stored verification values**  
   From: manual JSON parsers in email change, email list, and two-factor DAL  
   To: feature-local internal validation schemas  
   Removes duplication from: three hand-written parse/type-check implementations  
   Risk: Low  
   Value: High

6. **Standardize admin query contracts**  
   From: mixed `lib`, `components`, and Zod query implementations  
   To: feature modules under `src/lib/admin` plus small shared query primitives  
   Removes duplication from: scalar extraction, raw URL serialization, and form parsing  
   Risk: Medium  
   Value: High

7. **Extract the contact submission workflow**  
   From: `src/server/routes/contact.ts`  
   To: `src/server/contact/service.ts`  
   Removes duplication from: public form honeypot/rate-limit orchestration  
   Risk: Low  
   Value: Medium

8. **Consolidate server-side auth resolution and Next response mapping**  
   From: Elysia auth macros, current-user helper, and two Next route handlers  
   To: one current-user resolver plus transport-specific adapters  
   Removes duplication from: session lookup, admin decision evaluation, and JSON denials  
   Risk: Medium  
   Value: High

9. **Create stable admin read DTOs above the DAL**  
   From: DAL-inferred `AdminUserDetail` imported by components  
   To: `src/server/admin/user-detail.ts`  
   Removes duplication from: persistence-shape knowledge across four components  
   Risk: Low  
   Value: Medium

10. **Centralize the upload API contract**  
    From: inline TypeBox schemas and a separate client response type  
    To: `src/zod/uploads.ts` / `src/lib/uploads/contracts.ts`  
    Removes duplication from: route request/response types and avatar client type  
    Risk: Low  
    Value: Medium
