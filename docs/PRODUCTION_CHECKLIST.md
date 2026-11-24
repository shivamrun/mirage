# Production Checklist

This checklist records production-hardening concerns for the application.

These items are **not** default implementation work. Do not implement, modify,
or refactor code for any item in this checklist unless a user explicitly asks
for that production concern to be handled.

Use this document as a reminder before production deployment, infrastructure
changes, security reviews, or reliability hardening passes.

## Deployment Target

- The intended production target is a bare-metal server or VPS.
- Treat managed platform assumptions, such as provider-controlled request IP
  headers or built-in deployment rollbacks, as unavailable unless the chosen VPS
  setup explicitly provides them.
- Prefer documenting the actual reverse proxy, process manager, firewall, and
  backup setup once production infrastructure is selected.

## Request Identity

- Confirm the production host, CDN, or reverse proxy provides a trusted client
  IP signal before relying on IP-based rate limits.
- Configure `TRUSTED_CLIENT_IP_HEADER` only after the reverse proxy owns that
  header. Supported values are `cf-connecting-ip`, `forwarded`,
  `x-forwarded-for`, and `x-real-ip`.
- Strip or overwrite incoming browser-supplied IP headers at the trusted edge.
  Headers such as `cf-connecting-ip`, `x-real-ip`, `x-forwarded-for`, and
  `forwarded` are only trustworthy if the deployment layer controls them.
- Document the canonical production client-IP source for this app after the
  host is chosen.
- Keep local/test behavior separate from production trust assumptions.

## Rate Limiting

- Verify public form rate limits use trusted request identity in production.
- Confirm multi-bucket policies fail without consuming unrelated quota.
- Review per-client, per-destination, and global limits against expected launch
  traffic.
- Confirm retry headers and user-facing error messages are acceptable for
  production UX.

## Environment And Secrets

- Set all required runtime values in the production environment:
  `DATABASE_URL`, `NEXT_PUBLIC_BASE_URL`, `BETTER_AUTH_URL`, and
  `BETTER_AUTH_SECRET`.
- Use a strong `BETTER_AUTH_SECRET` of at least 32 characters.
- Confirm no production secrets are committed or hardcoded.
- Verify production URLs are configured through environment variables, not
  source constants.

## Database

- Run migrations through the normal Drizzle migration workflow.
- Do not edit generated migration files manually.
- Before applying migration `0031_lucky_arclight.sql`, back up the database and
  audit the rows covered by its new constraints:

  ```sql
  SELECT child.id, child.reverses_ledger_entry_id
  FROM credit_ledger_entries AS child
  LEFT JOIN credit_ledger_entries AS parent
    ON parent.id = child.reverses_ledger_entry_id
  WHERE child.reverses_ledger_entry_id IS NOT NULL AND parent.id IS NULL;

  SELECT stripe_subscription_id, count(*) AS duplicate_count,
         array_agg(id ORDER BY period_end DESC NULLS LAST) AS subscription_ids
  FROM subscription
  WHERE stripe_subscription_id IS NOT NULL
  GROUP BY stripe_subscription_id
  HAVING count(*) > 1;
  ```

  Both queries must return zero rows before migration. For an orphaned reversal,
  restore the missing parent from backup or, after verifying the ledger history,
  clear the invalid reversal pointer and record the remediation. For duplicate
  Stripe subscription IDs, identify the canonical row from Stripe and related
  ledger/period records, repoint any application references if needed, then
  archive or clear the Stripe ID on the duplicate row. Perform remediation in a
  transaction, retain an audit export of affected rows, and rerun both queries.
- Verify backup, restore, and rollback procedures before launch.
- Confirm production database access is restricted to expected services and
  operators.

## Email

- Confirm the production email provider is configured and verified.
- Verify sender domains, SPF, DKIM, and DMARC.
- Test account verification, password reset, email change, two-factor email
  fallback, and email-list verification flows.
- Decide how failed email delivery should be monitored and retried.

## Stripe Billing

- Confirm `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are configured in the
  production environment.
- Create the Better Auth Stripe webhook endpoint:
  `https://<production-domain>/api/auth/stripe/webhook`.
- Select at least these events for the Better Auth endpoint:
  `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
  `customer.subscription.created`, `customer.subscription.updated`, and
  `customer.subscription.deleted`, plus `invoice.paid` and `invoice.payment_failed`.
- Verify the Stripe lookup keys used by the billing catalog exist in the
  production Stripe account: `mirage_pro_2_monthly`,
  `mirage_pro_2_yearly`, `mirage_hacker_monthly`, and
  `mirage_hacker_yearly`, plus `one_time_credit`.
- Send a Stripe test webhook event in a production-like environment and confirm
  the request is accepted before launch.

## Authentication And Admin Access

- Verify admin accounts require the intended role, verified email, and two-factor
  assurance.
- Test session revocation, password reset, impersonation, and linked-account
  management in a production-like environment.
- Confirm protected routes do not reveal admin-only resources to unauthenticated
  or unauthorized users.

## Monitoring And Operations

- Configure production logging and error reporting.
- Confirm request IDs are preserved through the hosting layer.
- Add alerts for elevated 4xx/5xx rates, email delivery failures, database
  errors, and rate-limit spikes.
- Verify Redis availability before running multiple app instances, because
  notification SSE fanout across instances depends on `REDIS_URL`.
- Document incident response ownership and escalation paths.

## Deployment

- Run the expected pre-deploy checks:
  `pnpm lint`, `pnpm build`, and the relevant test suite.
- Confirm production build output is generated from the intended commit.
- Verify health checks and smoke tests after deployment.
- Keep rollback instructions close to the deployment workflow.
