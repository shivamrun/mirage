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

Feature code calls the public service. Use `notify()` when notification creation
is required for the operation to be considered successful:

```ts
await notify({
  type: "system.announcement",
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

For user-facing or webhook flows where the primary business action has already
succeeded, use `notifyBestEffort()`:

```ts
await notifyBestEffort(
  {
    type: "billing.credit_top_up_completed",
    recipientId: userId,
    subject: {
      type: "stripe_checkout_session",
      id: session.id,
    },
    data: {
      amount: 200,
    },
    idempotencyKey: `billing:credit_top_up:${session.id}`,
  },
  "billing.credit_top_up_completed",
);
```

`notifyBestEffort()` calls `notify()`, logs failures, and returns `null` instead
of throwing. Use it after critical state changes such as email changes, credit
grants, and Stripe webhook reconciliation so a notification write failure does
not roll back the user-visible outcome or cause webhook retries.

## Strict Vs Best-Effort

Use `notify()` when:

- The caller is explicitly creating a notification as the main action.
- A test needs to assert validation, persistence, or idempotency behavior.
- Internal tooling should fail loudly if the notification cannot be stored.
- The notification must be returned to the caller immediately.

Use `notifyBestEffort()` when:

- The business operation already succeeded and should not be reported as failed.
- The caller is inside a webhook where throwing may trigger provider retries.
- The notification is a secondary UX signal, such as account, billing, or credit
  activity.

Examples:

- Email change requested: use `notifyBestEffort()` after creating the pending
  verification record. If the notification fails, the email challenge should
  still be usable.
- Email change completed: use `notifyBestEffort()` after the user email is
  updated. If the notification fails, the user should still land on the success
  redirect.
- Credit top-up completed: use `notifyBestEffort()` after credits are granted.
  A notification failure must not cause Stripe to retry a fulfilled checkout.
- System announcement tooling: use `notify()` when the tool's explicit purpose
  is to create notifications and report failures.

## Registry And Payloads

`notificationRegistry` is the source of truth for notification type, category,
supported channels, and payload schema. Add a new type by:

1. Adding a Zod schema in `registry/payloads.ts`.
2. Adding a registry entry in `registry/registry.ts`.
3. Adding a presenter in `registry/presentation.ts`.

The `NotifyInput` type derives `data` from the payload map, so callers get
compile-time checking for each notification type. Runtime validation still runs
inside `notify()` before data is stored. `notifyBestEffort()` uses the same
validation path and only changes error handling.

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
Use `notify()` or `notifyBestEffort()` so later phases can add dispatching,
preferences, and additional channels without changing callers.

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
