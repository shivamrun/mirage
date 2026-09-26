# Rate limit adapter

The rate limit adapter lives in `src/adapters/rate-limit` and provides
fixed-window throttling for public writes, authenticated account email sends,
route mutations, and upload preparation. Product code should use these helpers
or the `routeLimit` macro instead of creating ad hoc counters.

The adapter is designed to be durable and privacy-safe:

- Redis is preferred for fast atomic counters.
- The database store is the fallback when Redis is missing or unavailable.
- Identifiers are HMAC digests, not raw emails, user IDs, or IP addresses.
- A single policy can consume several buckets at once.
- Denied requests receive a `retryAfterSeconds` value for `Retry-After`.
- Expired database rows are pruned opportunistically.

## Files

| File | Purpose |
| --- | --- |
| `index.ts` | Public high-level helpers for public writes and account email sends. |
| `policies.ts` | Policy definitions, identifier helpers, and bucket builders. |
| `types.ts` | Shared result, bucket, store, and policy-name types. |
| `store.ts` | Public store facade with Redis-first behavior and database fallback. |
| `stores/redis.ts` | Atomic Redis fixed-window implementation using a Lua script. |
| `stores/database.ts` | Transactional Postgres fallback using `application_rate_limit`. |
| `src/server/http/request-policy.ts` | Elysia `sameOrigin` and `routeLimit` macros. |
| `src/features/uploads/rate-limit.ts` | Upload-specific wrapper around upload prepare buckets. |

## Configuration

| Env var | Notes |
| --- | --- |
| `BETTER_AUTH_SECRET` | Used as the HMAC key for rate-limit identifiers. Must be strong and stable. |
| `TRUSTED_CLIENT_IP_HEADER` | Optional trusted proxy header used to derive client identifiers. |
| `REDIS_URL` | Enables Redis-backed counters. Missing value uses the database store. |
| `REDIS_KEY_PREFIX` | Prefix for Redis keys. |

Only configure `TRUSTED_CLIENT_IP_HEADER` when the app is behind trusted
infrastructure that overwrites that header. Supported values are:
`cf-connecting-ip`, `forwarded`, `x-forwarded-for`, and `x-real-ip`.

## Current Policies

Public write policies use a 15 minute window.

| Flow | Buckets | Limits |
| --- | --- | --- |
| `contact` | per client, per destination email, global | 5/client, 5/destination, 250/global |
| `email-list` | per destination email, global | 8/destination, 500/global |

Account email send policies use a 60 second cooldown.

| Flow | Buckets | Limits |
| --- | --- | --- |
| `email-change` | per account, per destination email | 1/account, 1/destination |
| `email-verification` | per account, per destination email | 1/account, 1/destination |
| `two-factor` | per account, per destination email | 1/account, 1/destination |

Route policies use a 15 minute window.

| Policy | User/client limit | Trusted client limit | Fallback route limit | Message |
| --- | ---: | ---: | ---: | --- |
| `account-email-mutation` | 12 | 60 | 12 | Too many account email requests. Please try again later. |
| `account-two-factor-mutation` | 20 | 80 | 20 | Too many two-factor requests. Please try again later. |
| `admin-security-mutation` | 40 | 80 | 40 | Too many admin security requests. Please try again later. |
| `billing-checkout` | 8 | 40 | 8 | Too many checkout requests. Please try again later. |
| `contact-submit` | 30 | none | 500 | Too many contact submissions. Please try again later. |
| `credits-sample-create` | 60 | none | 60 | Too many credit sample requests. Please try again later. |
| `email-list-signup` | 60 | none | 750 | Too many email signups. Please try again later. |
| `uploads-prepare` | 100 | 200 | 100 | Too many upload requests. Please try again later. |

Upload prepare policies use a 60 second window.

| Policy | User limit | Trusted client limit | Message |
| --- | ---: | ---: | --- |
| `avatar` | 12 | 60 | Too many avatar upload requests. |

## Public Write Usage

Use `consumePublicWriteLimit` for unauthenticated public forms where the
destination address is part of the abuse surface.

```ts
import {
  consumePublicWriteLimit,
  getPublicClientIdentifier,
} from "@/adapters/rate-limit";

const rateLimit = await consumePublicWriteLimit({
  clientIdentifier: getPublicClientIdentifier(headers),
  destination: values.email,
  flow: "contact",
});

if (!rateLimit.allowed) {
  return {
    retryAfterSeconds: rateLimit.retryAfterSeconds,
    status: "rate-limited",
  };
}
```

`contact` uses client, destination, and global buckets. `email-list` uses
destination and global buckets because a client identifier may not be available
or reliable for every signup request.

## Account Email Send Usage

Use `consumeAccountEmailSendLimit` before sending account-related verification,
email-change, or two-factor messages.

```ts
import { consumeAccountEmailSendLimit } from "@/adapters/rate-limit";

const rateLimit = await consumeAccountEmailSendLimit({
  accountId: user.id,
  destination: email,
  flow: "email-verification",
});

if (!rateLimit.allowed) {
  return {
    retryAfterSeconds: rateLimit.retryAfterSeconds,
    status: "rate-limited",
  };
}
```

Use the optional `variant` field when two sends in the same flow should have
separate cooldown identities.

## Route Macro Usage

Use `routeLimit` from `src/server/http/request-policy.ts` for Elysia routes.

```ts
.post(
  "/billing/checkout",
  async ({ body, user }) => createCheckout(body, user.id),
  {
    sameOrigin: true,
    routeLimit: "billing-checkout",
  },
)
```

The macro:

- builds buckets with `buildRouteRateLimitBuckets`;
- prefers `authUser.id` over `user.id` when present;
- uses a user bucket for authenticated requests;
- also adds a trusted-client bucket when a trusted client identifier exists and
  the policy has `trustedClientLimit`;
- uses a client bucket for unauthenticated requests with a trusted client
  identifier;
- falls back to a route bucket when no user or client identifier is available;
- returns `429` with `Retry-After` and the policy message when denied.

`sameOrigin` is separate from rate limiting. Use it for browser-only mutation
routes that should reject cross-origin form or fetch attempts.

## Upload Prepare Usage

Use the upload wrapper in `src/features/uploads/rate-limit.ts` for upload
preparation flows:

```ts
const limit = await consumeUploadPrepareLimit({
  headers,
  key: "avatar",
  userId,
});

if (!limit.allowed) {
  return status(429, {
    message: limit.message,
    retryAfterSeconds: limit.retryAfterSeconds,
  });
}
```

The wrapper maps the upload asset key to an upload prepare policy and adds the
right user/client buckets.

## How It Works

A rate-limit policy is an array of buckets:

```ts
type RateLimitBucket = {
  identifierHash: string;
  limit: number;
  scope: string;
  windowMs: number;
};
```

All buckets must allow the request. If any bucket is exhausted, the store returns
`{ allowed: false, retryAfterSeconds }` and no bucket is incremented.

Identifiers are created with:

```ts
HMAC-SHA256(BETTER_AUTH_SECRET, `${kind}:${normalizedValue}`)
```

That keeps raw emails, user IDs, and client IPs out of Redis keys and database
rows. The `kind` value prevents collisions between different identifier types
that happen to share the same string value.

### Redis Store

Redis keys are built with a hash tag so related rate-limit keys land in the same
cluster slot:

```text
{<REDIS_KEY_PREFIX>:ratelimit}:fixed:v1:<hash(scope)>:<hash(identifierHash)>
```

The Redis store uses one Lua script to check every bucket, calculate retry time,
and increment every allowed bucket atomically. Each key expires after its window
using `PEXPIRE`.

### Database Store

The database fallback stores counters in `application_rate_limit` by
`scope` and `identifier_hash`. It runs in a transaction, locks buckets in a
stable sorted order, resets expired rows, checks all limits, and then increments
all allowed buckets.

`pruneExpired()` deletes expired rows in small batches. The high-level public
helpers call it before consuming a policy. Route macro usage consumes directly,
so cleanup is opportunistic rather than required for correctness.

### Fallback Behavior

`rateLimitStore` tries Redis when `REDIS_URL` is configured and Redis is not in
cooldown. If a Redis command fails, the adapter pauses Redis attempts for 5
seconds, logs at most once per minute, and serves the request through the
database store.

This means rate limiting should continue working during Redis outages, but the
active counters may differ between Redis and Postgres during the fallback
window.

## Rules For New Rate Limits

- Prefer an existing high-level helper or the `routeLimit` macro before adding a
  new custom call site.
- Add new named policies in `policies.ts`, not inline route constants.
- Use multiple buckets for layered protection: user or account, destination,
  trusted client, and global where appropriate.
- Never store raw identifiers in `identifierHash`. Use
  `digestRateLimitIdentifier`.
- Include a stable `scope` that describes the surface being protected.
- Keep public unauthenticated limits stricter than authenticated route limits.
- Set a user-facing message with the policy so routes do not invent different
  copy.
- Return or set `Retry-After` when a request is denied.
- Configure `TRUSTED_CLIENT_IP_HEADER` only behind a trusted proxy. Do not trust
  arbitrary client-supplied forwarding headers.
- Do not use rate limits as authorization, fraud detection, or payment
  idempotency. They are backpressure only.
- Tests should cover both the allowed path and the exhausted path for new
  business-critical policies.
