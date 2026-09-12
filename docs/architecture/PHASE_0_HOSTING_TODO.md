# Phase 0 hosting facts — to do when deploying

**Status (2026-09-12):** This app is not hosted yet. These production questions cannot be answered from the code alone. There is no hosting setup to inspect today. Keep this list for the first deployment; do not guess the answers.

**Why this matters:** The app uses client IP addresses for rate limits, opens database connections, sends email, and links to uploaded files. The safe settings depend on the services that actually run the app.

## When a host is chosen

- [ ] **Where does the app run?** Record the hosting provider, runtime (server, container, or serverless function), and who manages it.
- [ ] **How many copies can run at once?** Record the maximum number of running app instances or concurrent function invocations. This affects rate limits and database connections.
- [ ] **Which client IP can the app trust?** Check which request header the host or proxy sets, whether visitors can forge it, and how multiple proxies affect it. Test with a real deployed request before using that header for rate limits.
- [ ] **How does the app connect to Postgres?** Record the database provider, connection limit, whether a pooler is used, and the connection budget for all app instances together.
- [ ] **What are the public and auth URLs?** Confirm the production values and allowed origins for `NEXT_PUBLIC_BASE_URL` and `BETTER_AUTH_URL`. Check that sign-in and session cookies work on the real domain and over HTTPS.
- [ ] **What are the email limits?** Check the Resend account's sending limits and any provider rules that affect verification, reset, or 2FA emails.
- [ ] **Who can access uploaded files?** Record the S3 bucket's public-access policy, the upload URL/domain, and whether a signed-in user can retrieve another user's upload.
- [ ] **How are database changes released?** Record who runs `pnpm db:migrate`, when it runs relative to the app release, and how a failed release is rolled back.
- [ ] **Who owns backups and restores?** Record where backups are configured, who can restore them, and when a restore was last tested.

For each answer, record **the value, where it was checked** (dashboard setting or deployment test), **the date, and the owner**. Mark anything unavailable **Unknown / needs verification**. Do not copy passwords, API keys, tokens, or full database URLs into this document.

After these facts are checked, write a short deployment and rollback runbook in `docs/architecture`, then use the trusted IP and connection facts when working on Phases 1 and 4 of [REFACTOR_PLAN.md](REFACTOR_PLAN.md).
