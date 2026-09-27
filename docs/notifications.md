# Notifications

Phase 1 implements in-app notifications backed by Postgres. It deliberately does
not include queues, realtime delivery, email, push, preferences, digests, or
analytics.

## Structure

- `src/features/notifications/domain`: public notification types.
- `src/features/notifications/registry`: notification definitions, payload
  schemas, and presentation mapping.
- `src/features/notifications/channels/in-app`: Phase 1 delivery channel.
- `src/features/notifications/components`: account inbox UI pieces.
- `src/features/notifications/query`: page/limit URL parsing and href helpers.
- `src/server/db/schema/notifications.ts`: Drizzle table and indexes.
- `src/server/db/dal/notifications.ts`: owner-scoped database operations.
- `src/server/db/services/notifications/service.ts`: stable service API.
- `src/server/routes/account.ts`: authenticated JSON endpoints.

## Lifecycle

Feature code calls the public service:

```ts
await notify({
  type: "SYSTEM_ANNOUNCEMENT",
  recipientId,
  actorId,
  subject: {
    type: "release",
    id: releaseId,
  },
  data: {
    title: "Notifications ready",
    message: "Phase 1 is live.",
  },
  idempotencyKey: `system-announcement:${releaseId}:${recipientId}`,
});
```

`notify()` validates the type against the registry, validates the type-specific
payload with Zod, routes to the `in_app` channel, persists the row, and returns
the stored notification.

## Registry And Payloads

`notificationRegistry` is the source of truth for notification type, category,
supported channels, and payload schema. Add a new type by:

1. Adding a Zod schema in `registry/payloads.ts`.
2. Adding a registry entry in `registry/registry.ts`.
3. Adding a presenter in `registry/presentation.ts`.

The `NotifyInput` type derives `data` from the payload map, so callers get
compile-time checking for each notification type. Runtime validation still runs
inside `notify()` before data is stored.

## Idempotency

`idempotencyKey` is optional, but callers should provide it for retryable or
repeatable workflows. The database has a unique index on the key. If a duplicate
request races or retries, the DAL resolves and returns the existing row instead
of surfacing a raw constraint error.

## In-App Delivery

Phase 1 has one channel: `in_app`. The channel writes structured notification
data to `mirage_notification`. Stored rows include recipient, optional actor,
type, category, optional subject, JSON payload, idempotency key, `seenAt`,
`readAt`, `archivedAt`, and timestamps.

Feature code should not insert notification rows directly or call the channel.
Use `notify()` so later phases can add dispatching, preferences, and additional
channels without changing callers.

## Pagination

The account inbox uses the existing page/limit pagination stack:

`query parser -> DAL limit/offset -> paginateList() -> resolvePaginatedView() -> page -> <Pagination />`

First-page URLs omit `?page=1`. Malformed pages normalize to page 1, and
out-of-range pages resolve through the shared pagination service.

## Read State

`readAt` is the canonical read/unread state. Marking read, unread, and all read
is idempotent. All DAL mutations include `recipientId` in the `where` clause so
users cannot update another user's notifications.

`seenAt` is stored for future inbox behavior but is not actively managed in
Phase 1.

## Presentation

Notifications store structured data, not rendered strings. UI text and hrefs are
derived by `presentNotification()`, which delegates to the presenter registered
for each type. This keeps historical rows independent from template changes and
future channel-specific rendering.
