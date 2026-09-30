# Admin user invitations

Invitations are seven-day, single-use credentials created by a verified admin
with current two-factor session assurance. An invitation is bound to one
normalized email address and grants either the base `user` role or the
canonical `user,admin` role set.

## Lifecycle

- **Create:** creation is serialized by normalized email. Existing users and a
  second active invitation are rejected. Only a keyed HMAC of the random token
  is stored.
- **Deliver:** new email links put the token in the URL fragment so it is not
  sent in HTTP request targets. Legacy query-token links remain accepted during
  migration and are removed from browser history immediately.
- **Resend:** a conditional token rotation invalidates the old link. If email
  delivery fails, another conditional write restores the previous token and
  expiry without overwriting an acceptance, revocation, or newer resend.
- **Accept:** validation requires the original email, a pending unexpired
  token, captcha, same-origin submission, and the public rate limit. Signup,
  invitation claim, and canonical role assignment must all succeed before auth
  cookies are returned.
- **Revoke/expire:** revocation is terminal. Expiry is derived from
  `expiresAt`; expired, revoked, accepted, rotated, and replayed tokens cannot
  create or elevate an account.

If the email registers independently, the invitation cannot grant a role and
is conditionally revoked when acceptance or resend detects the account. If
Better Auth creates a user but invitation finalization loses a race, recovery
deletes only that exact unverified base-role user and its new Stripe customer.
If cleanup cannot be confirmed, the account is forced to the base role, all
sessions are revoked, no cookies are returned, and support intervention is
required.

## Security and operations

- Raw tokens and token hashes never appear in admin/public responses, cookies,
  or application logs. Invitation pages use `no-store` and `no-referrer`.
- Admin reads and mutations use the established admin gate; mutations also
  require same-origin requests and the admin invitation rate limit.
- Public validation uses a same-origin rate-limited POST body. Acceptance also
  passes the Turnstile response to Better Auth and uses a safe local redirect.
- API errors expose stable status classes and sanitized messages, never Better
  Auth, database, Stripe, or email-provider details.

For an ambiguous initial delivery failure, the invitation is conditionally
revoked. For a resend failure, the prior link is restored when it is still safe
to do so. A cleanup-required acceptance error must be investigated before the
affected email is invited again; confirm that the user has no sessions or
privileged role and reconcile its Stripe customer before removing the account.
