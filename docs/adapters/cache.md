# Cache adapter

The cache adapter lives in `src/adapters/cache` and provides a small
server-only API for short-lived Redis-backed application caching. Product code
should use this adapter, or the `routeCache` macro built on top of it, instead
of calling Redis directly.

The adapter is intentionally conservative:

- Cache is optional. Without `REDIS_URL`, every read is a miss and writes are
  ignored.
- Redis failures degrade to misses. Business code must still be correct when
  cache is unavailable.
- Values are JSON serialized.
- Cache keys include a policy version and hashed key parts.
- Policies declare privacy, TTL, and stale-data expectations in one place.
- Generation counters are used when many cache entries need invalidation.

## Files

| File | Purpose |
| --- | --- |
| `index.ts` | Public exports for policies, store, and serialization helpers. |
| `policies.ts` | Named cache policies with privacy, TTL, version, and stale-data notes. |
| `store.ts` | Public `cacheStore` facade with Redis availability cooldown and miss fallback. |
| `serialization.ts` | JSON serialize/deserialize helpers and optional validators. |
| `stores/redis.ts` | Redis implementation for values and generation counters. |
| `../redis/client.ts` | Shared Redis client, timeout, and health helpers. |
| `../redis/keys.ts` | Redis key builders and hashed key-part utilities. |

## Configuration

The adapter uses the shared Redis configuration:

| Env var | Notes |
| --- | --- |
| `REDIS_URL` | Enables Redis-backed cache operations. Missing value makes the adapter a no-op miss store. |
| `REDIS_KEY_PREFIX` | Prefix used by Redis key builders so environments can share a Redis instance safely. |

Redis commands have a default 750 ms timeout in `src/adapters/redis/client.ts`.
When a Redis command fails, the cache facade pauses Redis attempts for 5 seconds
and logs at most once per minute.

## Current Policies

Policies live in `src/adapters/cache/policies.ts`.

| Policy | Privacy | TTL | Notes |
| --- | --- | ---: | --- |
| `activeEmailLists` | `public` | 60s | Public list visibility cache. Invalidate before relying on immediate visibility changes. |
| `adminEmailListSummary` | `admin` | 30s | Admin summaries may briefly lag after email-list mutations. |
| `apiCreditBalance` | `private` | 15s | Credit mutations increment a per-user generation counter. |
| `creditBalance` | `private` | 15s | Credit mutations must invalidate or bypass before displaying updated balances. |
| `userPostsPage` | `private` | 60s | Paginated private collections should include a generation value. |

Privacy is enforced by the route cache macro:

- `public`: no authenticated user is required.
- `private`: requires `context.user.id` and adds it to the key.
- `admin`: requires `context.authUser.id` with an `admin` role and adds it to
  the key.

Direct `cacheStore` usage does not enforce auth or privacy. Callers must include
safe key parts and must not cache data across users accidentally.

## Direct Usage

Use `cacheStore` only from server code.

```ts
import { cacheStore } from "@/adapters/cache";

const summary = await cacheStore.getOrSet({
  policy: "adminEmailListSummary",
  parts: ["workspace", workspaceId],
  validator: parseEmailListSummary,
  load: () => loadEmailListSummary(workspaceId),
});
```

The public store supports:

| Method | Use |
| --- | --- |
| `get({ policy, parts, validator })` | Read a value. Returns `null` on miss, unavailable Redis, parse error, or validation error. |
| `set({ policy, parts, value })` | JSON serialize and store using the policy TTL. |
| `getOrSet({ policy, parts, validator, load })` | Read-through helper. Loads and stores when the cache misses. |
| `delete({ policy, parts })` | Delete one exact cache key. |
| `getGeneration({ policy, parts })` | Read a generation counter. Returns `null` when missing or unavailable. |
| `incrementGeneration({ policy, parts })` | Increment a generation counter and return the new value, or `null` when unavailable. |

`parts` is optional and defaults to an empty array. Every part is SHA-256 hashed
before it becomes part of a Redis key, so raw emails, user IDs, query strings,
and other identifiers are not visible in Redis key names.

Use a validator when reading data that crosses a trust boundary or could become
stale after a shape change:

```ts
type CreditBalanceCache = {
  balance: number;
};

function parseCreditBalanceCache(value: unknown): CreditBalanceCache {
  if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as CreditBalanceCache).balance === "number"
  ) {
    return value as CreditBalanceCache;
  }

  throw new Error("Invalid credit balance cache payload.");
}
```

## Route Cache Usage

Elysia routes should prefer the `routeCache` macro from
`src/server/http/response-cache.ts` when caching JSON-style `GET` or `HEAD`
responses.

```ts
.get(
  "/credits/balance",
  async ({ user }) => getCreditBalance(user.id),
  {
    routeCache: {
      policy: "apiCreditBalance",
      generationParts: ({ user }) => ["credit-balance", user.id],
      validator: parseCreditBalanceResponse,
    },
  },
)
```

The macro:

- only caches `GET` and `HEAD`;
- sets `X-Cache` to `BYPASS`, `MISS`, or `HIT`;
- includes method, route, sorted query params, privacy parts, custom parts, and
  optional generation value in the key;
- stores only 200 responses that can be JSON serialized;
- returns `401` when a private or admin policy is used without the required
  authenticated context;
- never caches native `Response` objects.

Use `parts` for dimensions that change the response but are not already covered
by method, route, query string, user, or admin ID. Use `generationParts` when a
mutation should invalidate a group of related keys without knowing every cached
query/page variant.

## Invalidation

Use direct deletion when there is exactly one cache key:

```ts
await cacheStore.delete({
  policy: "activeEmailLists",
  parts: ["audience", audienceId],
});
```

Use generation counters when there are many cached variants, such as paginated
or query-filtered responses:

```ts
export function creditBalanceGenerationParts(userId: string) {
  return ["credit-balance", userId];
}

export async function invalidateCreditBalanceCache(userId: string) {
  await cacheStore.incrementGeneration({
    policy: "apiCreditBalance",
    parts: creditBalanceGenerationParts(userId),
  });
}
```

The route cache reads the generation counter and includes the current value in
the response cache key. Incrementing the counter makes future reads use a new
key while old keys expire naturally by TTL.

## How It Works

`cacheStore` checks whether Redis is configured and not in cooldown. If Redis is
unavailable, reads return `null`, writes/deletes do nothing, and generation
operations return `null`.

For values, Redis keys are built as:

```text
<REDIS_KEY_PREFIX>:cache:<policy>:v<version>:<hash(part)>...
```

For generation counters:

```text
<REDIS_KEY_PREFIX>:cache-generation:<policy>:v<version>:<hash(part)>...
```

`set` uses `SETEX` with the policy TTL. `get` deserializes JSON and then runs an
optional validator. Any parse, validation, or Redis error is handled as a miss
by the facade.

Policy `version` is a coarse invalidation tool. Bump it when the cached value
shape or key meaning changes globally. For routine data mutations, prefer
`delete` or generation counters.

## Rules For New Cache Usage

- Add a named policy before adding a new cache call.
- Choose the narrowest privacy level. Never cache user-specific data under a
  `public` policy.
- Keep TTLs short unless the stale-data behavior is fully understood.
- Write a clear `staleDataNotes` value that says how freshness is maintained.
- Include every response-changing input in `parts`, or rely on route-cache query
  normalization when query params are sufficient.
- Use `generationParts` for paginated or filtered collections that are mutated
  elsewhere.
- Do not cache secrets, raw tokens, auth sessions, private request bodies, or
  data whose authorization changes cannot be represented in the key.
- Do not rely on cache writes succeeding. The database or source service remains
  the source of truth.
- Add a validator for non-trivial cached payloads and route responses.
- Bump the policy `version` when old entries cannot be safely parsed or used.
