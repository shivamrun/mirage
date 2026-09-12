# Phase 0 test plan

**Status (2026-09-12):** The isolated test harness and all five critical test groups are set up. This is a short list of the most important behavior to protect before changing security and account workflows. See [REFACTOR_PLAN.md](REFACTOR_PLAN.md) for the larger plan.

## First, set up a safe place to run tests

- [x] Add a focused test runner, Vitest, and a `pnpm test` command.
- [x] Use a separate test Postgres database. Tests must never use development or production data.
- [x] Apply the existing migrations to that test database and reset test data between tests.
- [x] Replace real email sends with a test fake so tests do not send messages.

Run `pnpm test:db:up` to start the dedicated local Postgres instance on port 5433, then run `pnpm test`. The test runner applies the checked-in Drizzle migrations and clears application tables before each test. It captures outgoing email in `testEmailOutbox` instead of calling Resend. Run `pnpm test:db:down` when finished; this leaves the test database volume intact.

The default test URL is `postgres://postgres:postgres@127.0.0.1:5433/mirage_test`. To use a different local test database, set `TEST_DATABASE_URL` before running `pnpm test`. The runner refuses remote hosts, names without `_test`, and the database targeted by the current `DATABASE_URL` or any supported local `.env*` file. If a local env assignment cannot be parsed safely, the runner stops before connecting. Do not use the normal `pnpm db:migrate` command for test setup because its config reads application env files.

## Critical tests, in priority order

1. **Admin access** — `src/server/routes/auth.ts`, `src/server/routes/admin/index.ts`, and Better Auth admin endpoints.
   - [x] A visitor and a normal user cannot call admin APIs.
   - [x] An admin whose email is not verified cannot call admin reads or mutations; this is the intended policy in the admin UI.
   - [x] A verified admin can still perform allowed actions.
   - [x] Check Better Auth admin actions as well as the custom Elysia admin API; blocking the page alone does not protect either API.

2. **Email-change tokens** — `src/server/account/email-change.ts` and `src/server/db/dal/email-change.ts`.
   - [x] Invalid and expired tokens do not change the email address.
   - [x] A token used once cannot change the account again.
   - [x] Two requests using the same token at the same time cannot both win.
   - [x] The approval and new-email confirmation steps accept only the correct token for the correct step.

3. **Two-factor authentication** — `src/server/account/two-factor.ts` and `src/server/db/dal/two-factor.ts`.
   - [x] A wrong email code increases the failure count and the code stops working after the allowed number of attempts.
   - [x] Expired and already-used email codes fail.
   - [x] Two wrong-code requests at the same time cannot bypass the attempt limit.
   - [x] After setup or disable, the two-factor row and the user's enabled flag agree.

4. **Public contact and email signup** — `src/server/routes/contact.ts`, `src/server/routes/email-list.ts`, and `src/server/db/dal/email-list.ts`.
   - [x] Requests from an untrusted origin and malformed form data are rejected.
   - [x] Repeated requests hit the local rate limit; changing a client-supplied IP header does not bypass it.
   - [x] An email-list verification token cannot be used twice, including by simultaneous requests.
   - [x] A failed verification email has a clear retry path and does not remove another request's pending signup.

   The local limits use a keyed digest of the submitted email and live in process memory. Add a shared edge limit based on a trusted client IP source when the hosting provider and proxy configuration are defined; the local limit alone does not cover requests distributed across instances or changing email addresses.

5. **Admin account and session deletion** — `src/server/routes/admin/index.ts` and `src/server/db/dal/admin-user-detail.ts`.
   - [x] An admin cannot delete an account or session by pairing one user's ID with another user's row ID.
   - [x] Password credentials cannot be unlinked through the linked-account endpoint.
   - [x] A missing account or session returns the expected not-found response.

Start with a few tests for the **current behavior**. If a test reveals an existing bug, keep it as a regression test for the matching fix in a later phase. Do not make a broad test-framework project before these paths are covered.
