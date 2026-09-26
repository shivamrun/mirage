# Analytics adapter

The analytics adapter lives in `src/adapters/analytics` and wraps Umami behind
typed client and server APIs. Product code should import this adapter instead
of calling `window.umami`, loading scripts, or posting to Umami directly.

The adapter is intentionally small:

- Umami owns automatic page views and client-side route changes.
- Mirage emits only named product events.
- Browser events and server events use separate event maps.
- Revenue and lifecycle events are awaited with a short timeout, but analytics
  failures never block the business action.
- Distinct IDs are internal user IDs only. Do not send email, name, raw URLs,
  tokens, request bodies, or user-authored message text.

## Files

| File | Purpose |
| --- | --- |
| `events.ts` | Event maps, exact-property track type, currency helper, and Distinct ID validation. |
| `client.ts` | Browser-safe `analytics.track(...)` and `analytics.identify(userId)`. |
| `server.ts` | Server-only direct Umami `/api/send` transport. |
| `script.tsx` | Server component that renders the Umami tracker script. |
| `auth-identifier.tsx` | Tiny client component that identifies the signed-in user once per user ID. |
| `attribution.ts` | Browser helper that captures first-touch campaign attribution. |
| `attribution-capture.tsx` | Mount-only component that stores attribution once per session. |
| `config.ts` | Reads env config and decides whether client/server analytics are enabled. |

## Configuration

Analytics is optional. Missing config should make the adapter no-op.

| Env var | Used by | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_UMAMI_ENABLED` | client and server | Optional boolean flag. Defaults to enabled only in production. Always disabled in `test`. |
| `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | client and server | Umami website ID. Required for any analytics delivery. |
| `NEXT_PUBLIC_UMAMI_SCRIPT_URL` | client | Tracker script URL. Required only for browser tracking. |
| `NEXT_PUBLIC_UMAMI_DOMAINS` | client | Optional Umami domain filter. |
| `UMAMI_HOST_URL` | server | Umami host used for direct server `POST /api/send`. Required only for server tracking. |

Client analytics requires `NEXT_PUBLIC_UMAMI_WEBSITE_ID` and
`NEXT_PUBLIC_UMAMI_SCRIPT_URL`.

Server analytics requires `NEXT_PUBLIC_UMAMI_WEBSITE_ID` and `UMAMI_HOST_URL`.

`src/app/layout.tsx` renders `UmamiAnalyticsScript`, which loads the script with
`data-exclude-search="true"` so query strings are not collected by default.

## Campaign Attribution

The adapter captures a privacy-safe first-touch attribution object in browser
`sessionStorage`. It never stores or sends raw query strings. It keeps only:

| Field | Source |
| --- | --- |
| `landingPath` | Current pathname only. |
| `referrerDomain` | Hostname from `document.referrer`, not the full URL. |
| `utmSource` | `utm_source` query param. |
| `utmMedium` | `utm_medium` query param. |
| `utmCampaign` | `utm_campaign` query param. |
| `utmContent` | `utm_content` query param. |
| `utmTerm` | `utm_term` query param. |
| `creator` | Explicit `creator` query param only. |

Use standard UTM links for campaigns:

```text
https://example.com/?utm_source=youtube&utm_medium=creator&utm_campaign=launch&creator=creator-slug
```

For creator promos, put the platform in `utm_source`, the channel type in
`utm_medium`, the campaign in `utm_campaign`, and the creator slug in an
explicit `creator` param. Use `utm_content` only for campaign content labels:

```text
https://example.com/?utm_source=youtube&utm_medium=creator&utm_campaign=launch&creator=creator-slug&utm_content=short-demo
```

Attribution is attached to key marketing events when available:

- `subscription_checkout_started`
- `credit_top_up_checkout_started`
- `credits_purchased`
- `email_list_signup_completed`
- `contact_submitted`

`signup_completed` is currently emitted from the Better Auth server hook and
does not receive browser attribution in v1.

## Event Maps

Events are split by source in `events.ts`:

- `ClientAnalyticsEventMap`: browser-only events.
- `ServerBestEffortEventMap`: server telemetry that can be fire-and-forget.
- `ServerAuthoritativeEventMap`: conversion and lifecycle events that should be
  awaited with a short timeout.

The exported `AnalyticsTrack<EventMap, Return, Options>` overload keeps usage
type-safe:

- events with no properties do not accept a properties object;
- events with properties require the correct shape;
- extra fields are rejected, including on typed variables;
- client code cannot emit server-only events;
- revenue events enforce `revenue` and `currency` together.

## Client Usage

Use the client adapter only from client components.

```ts
import { analytics } from "@/adapters/analytics/client";

analytics.track("login_completed");

analytics.track("subscription_checkout_started", {
  attribution: getAnalyticsAttribution(),
  billingInterval: "monthly",
  plan: "pro",
  scheduleAtPeriodEnd: false,
});
```

For authenticated browser sessions, do not call `identify` in every feature.
`AnalyticsAuthIdentifier` is rendered once in `AppProvider` and calls:

```ts
analytics.identify(session.user.id);
```

It validates that the ID is non-empty and at most 50 characters, then guards
duplicate calls with a `useRef` holding the last identified ID.

## Server Usage

Use the server adapter only from server code.

Best-effort events can be fire-and-forget:

```ts
import { analytics } from "@/adapters/analytics/server";

void analytics.track(
  "credits_consumed",
  {
    source: "sample_credit_lab",
    itemKey: item.key,
    credits: item.credits,
  },
  {
    context: { distinctId: user.id, url: "/credits" },
  },
);
```

Authoritative events should be awaited:

```ts
await analytics.trackAuthoritative(
  "credits_purchased",
  {
    attribution: {
      utmSource: "youtube",
      utmMedium: "creator",
      utmCampaign: "launch",
      utmContent: "creator-slug",
      creator: "creator-slug",
    },
    credits: 200,
    revenue: 50,
    currency: "USD",
  },
  {
    context: { distinctId: userId, url: "/billing" },
  },
);
```

The server adapter sends:

```ts
{
  type: "event",
  payload: {
    website,
    hostname,
    url,
    name,
    data,
    id,
  },
}
```

Server requests include:

```text
Content-Type: application/json
User-Agent: Mirage/0.1 Analytics Server
```

`context.url` is normalized to a pathname only. Query strings are discarded.
`context.distinctId` becomes Umami `payload.id`; it is not included in event
properties.

## Current Events

| Event | Source | Trigger |
| --- | --- | --- |
| `signup_completed` | server best-effort | Better Auth user creation. |
| `login_completed` | client | Email/password login or login-mode 2FA success. |
| `email_list_signup_completed` | server best-effort | Email list signup accepted. |
| `contact_submitted` | server best-effort | Contact form submission saved. |
| `subscription_checkout_started` | client | Stripe subscription checkout URL returned. |
| `subscription_started` | server authoritative | Paid subscription credit grant newly applied. |
| `subscription_cancelled` | server authoritative | Better Auth subscription pending-cancel transition. |
| `credit_top_up_checkout_started` | server best-effort | Credit top-up checkout session created. |
| `credits_purchased` | server authoritative | Paid top-up ledger entry newly created. |
| `credits_consumed` | server best-effort | Credit Lab spend succeeds. |
| `credits_exhausted` | server best-effort | Credit Lab spend fails for insufficient credits. |

`subscription_changed` and `subscription_ended` are typed but not emitted in v1.
The current hooks do not expose a clean durable retry-safe transition for those
events. Add a small Stripe processed-event marker before emitting them.

## Idempotency

Do not add a generic analytics outbox by default. Prefer existing durable
business transitions:

- `credits_purchased` emits only when `grantCreditTopUp(...)` reports
  `created: true`.
- `subscription_started` emits only when subscription credit reconciliation
  reports `grantCreated: true`.
- `subscription_cancelled` relies on Better Auth's transition callback.

Best-effort events may be duplicated by retries, browser blockers, or user
actions. Do not use them as financial records.

## Privacy Rules

Allowed data:

- internal user ID as Umami Distinct ID;
- plan keys and billing intervals;
- credit counts and item keys;
- event source labels;
- referrer domains, not full referrer URLs;
- allowlisted UTM values and creator slugs;
- uppercase ISO currency codes.

Never send:

- email or name;
- passwords, auth/session tokens, API keys, or authorization headers;
- Stripe secrets or raw Stripe webhook bodies;
- uploaded file contents, filenames, or URLs;
- contact message text;
- raw request URLs with query strings.

If more attribution is needed later, add explicit allowlisted event properties
instead of collecting raw query strings.

## Adding Events

Add events in three small steps: type the event, emit it from the right source,
then add type-level coverage.

### 1. Choose The Event Source

Use the smallest source that matches the event:

| Source | Use for | API |
| --- | --- | --- |
| Client | Browser-only interactions after a successful UI action. | `analytics.track(...)` from `@/adapters/analytics/client` |
| Server best-effort | Non-financial server telemetry that can be fire-and-forget. | `void analytics.track(...)` from `@/adapters/analytics/server` |
| Server authoritative | Revenue, purchase, subscription, or lifecycle events. | `await analytics.trackAuthoritative(...)` from `@/adapters/analytics/server` |

Prefer the durable business transition over a broad UI trigger. For example,
emit a purchase event from the webhook or ledger write that proves the purchase
happened, not from the button click that starts checkout.

### 2. Type The Event

Add the event to exactly one map in `src/adapters/analytics/events.ts`.

Use `undefined` for events with no properties:

```ts
export type ClientAnalyticsEventMap = {
  login_completed: undefined;
};
```

Use a property object when the event needs data:

```ts
export type ServerBestEffortEventMap = {
  credits_consumed: {
    credits: number;
    itemKey: CreditSampleItemKey;
    source: "sample_credit_lab";
  };
};
```

For attribution-aware events, add `AnalyticsAttributionProperties`:

```ts
export type ServerBestEffortEventMap = {
  contact_submitted: {
    hasCompany: boolean;
  } & AnalyticsAttributionProperties;
};
```

For revenue events, include `AnalyticsRevenue` when revenue is optional but must
always be paired with currency:

```ts
export type ServerAuthoritativeEventMap = {
  subscription_started: {
    billingInterval: BillingCheckoutInterval;
    plan: BillingCheckoutPlan;
  } & AnalyticsRevenue;
};
```

Reuse existing domain types whenever possible, such as `PricingPlanKey`,
`BillingCheckoutInterval`, `CreditSampleItemKey`, and `AnalyticsCurrency`.

### 3. Emit The Event

Client events must be emitted only from client components:

```ts
"use client";

import { analytics } from "@/adapters/analytics/client";

analytics.track("login_completed");
```

Client events with attribution should read attribution at the moment the action
succeeds:

```ts
import { getAnalyticsAttribution } from "@/adapters/analytics/attribution";
import { analytics } from "@/adapters/analytics/client";

analytics.track("subscription_checkout_started", {
  attribution: getAnalyticsAttribution(),
  billingInterval: interval,
  plan,
  scheduleAtPeriodEnd: false,
});
```

Server best-effort events should not block the request:

```ts
import { analytics } from "@/adapters/analytics/server";

void analytics.track(
  "credits_consumed",
  {
    credits: item.credits,
    itemKey: item.key,
    source: "sample_credit_lab",
  },
  {
    context: { distinctId: user.id, url: "/credits" },
  },
);
```

Server authoritative events should be awaited:

```ts
import { analytics } from "@/adapters/analytics/server";

await analytics.trackAuthoritative(
  "credits_purchased",
  {
    attribution: analyticsAttributionFromMetadata(session.metadata),
    credits: creditTopUpProduct.credits,
    currency: normalizeAnalyticsCurrency(creditTopUpProduct.currency),
    revenue: creditTopUpProduct.amount / 100,
  },
  {
    context: { distinctId: userId, url: "/billing" },
  },
);
```

Put the user ID in `options.context.distinctId`, not in event properties. Use a
pathname for `options.context.url`; the server adapter discards query strings,
but call sites should still pass clean pathnames.

### 4. Add Type Coverage

Update `tests/analytics-events.test.ts` with one valid example and at least one
invalid example when the event has required properties or source restrictions.

Valid examples should compile:

```ts
serverTrack("credits_consumed", {
  credits: 10,
  itemKey: "tiny-note",
  source: "sample_credit_lab",
});
```

Invalid examples should use `@ts-expect-error` so `tsc` fails if the type guard
stops working:

```ts
// @ts-expect-error missing required property.
serverTrack("credits_consumed", {
  credits: 10,
  source: "sample_credit_lab",
});
```

Run:

```sh
pnpm exec tsc --noEmit --pretty false
pnpm exec vitest tests/analytics-events.test.ts
```

The Vitest command may require the test database if global setup is enabled.
When that is not available, `tsc --noEmit` is the important check for the
type-only examples.

### 5. Update This Document

Add the new event to the `Current Events` table with its source and trigger.
If the event introduces a new class of property, update the privacy rules too.
