# Analytics adapter

The analytics adapter lives in `src/adapters/analytics` and wraps Umami behind
typed client and server APIs. Product code should import this adapter instead
of calling `window.umami`, loading scripts, or posting to Umami directly.

The adapter is intentionally small:

- Umami owns automatic page views and client-side route changes.
- Mirage emits only named product events.
- Named product events use typed server event maps.
- Billing webhooks queue revenue and lifecycle events in Postgres. A worker
  delivers them to Umami and retries failed sends.
- Distinct IDs are internal user IDs only. Do not send email, name, raw URLs,
  tokens, request bodies, or user-authored message text.

## Files

| File | Purpose |
| --- | --- |
| `events.ts` | Event maps, exact-property track type, currency helper, and Distinct ID validation. |
| `client.ts` | Browser-safe `analytics.identify(userId)`. |
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
| `NEXT_PUBLIC_UMAMI_BROWSER_ENABLED` | client | Set to `true` to opt into browser analytics. Defaults to disabled. |
| `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | client and server | Umami website ID. Required for any analytics delivery. |
| `NEXT_PUBLIC_UMAMI_DOMAINS` | client | Optional Umami domain filter. |
| `UMAMI_HOST_URL` | server | Umami host used for direct server `POST /api/send`. Required only for server tracking. |

Client analytics requires `NEXT_PUBLIC_UMAMI_BROWSER_ENABLED=true` and
`NEXT_PUBLIC_UMAMI_WEBSITE_ID`. The shared enable flag still applies.
`NEXT_PUBLIC_BASE_URL` must match the public origin of the analytics-enabled
deployment. The browser loads `/stats.js` and posts to `/api/send` on that
origin. Next.js forwards both requests to Umami Cloud.

Server analytics requires `NEXT_PUBLIC_UMAMI_WEBSITE_ID` and `UMAMI_HOST_URL`.
Set `UMAMI_HOST_URL=https://gateway.umami.is` for direct server events on
Umami Cloud. Login and subscription checkout now require this server setting,
including deployments that previously tracked these events in the browser.
Startup logs a warning if browser analytics is enabled without a server host.

If you already collect browser analytics, set the browser opt-in before
redeploying the proxy. For server-only analytics, leave the browser opt-in unset.

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

- `signup_completed`
- `subscription_checkout_started`
- `subscription_started`
- `credit_top_up_checkout_started`
- `credits_purchased`
- `email_list_signup_completed`
- `contact_submitted`

Email and Google signup pass campaign fields to the user creation hook in a
short-lived cookie scoped to the auth API. Invitation signup sends the same
validated attribution in its request body. Subscription checkout carries
the same fields in Stripe metadata so they are available on subscription start.

## Event Maps

Server events are defined in two maps in `events.ts`:

- `ServerBestEffortEventMap`: server telemetry that can be fire-and-forget.
- `ServerAuthoritativeEventMap`: billing events delivered by the Postgres queue.

The exported `AnalyticsTrack<EventMap, Return, Options>` overload keeps usage
type-safe:

- events with no properties do not accept a properties object;
- events with properties require the correct shape;
- extra fields are rejected, including on typed variables;
- revenue events enforce `revenue` and `currency` together.

## Client Usage

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

Authoritative billing events use `queueBillingAnalytics` with a stable key
and the occurrence time from Stripe. The queue worker sends the event and
retries delivery independently of Stripe webhook processing.

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
| `signup_completed` | server best-effort | Email or OAuth account created. |
| `login_completed` | server best-effort | Session issued after password login, OAuth callback, or login-mode 2FA. |
| `email_list_signup_completed` | server best-effort | Email-list subscription newly active, immediately or after verification. |
| `contact_submitted` | server best-effort | Contact form submission saved. |
| `subscription_checkout_started` | server best-effort | Stripe subscription Checkout Session returned with a URL, including resumed checkout. |
| `subscription_started` | server authoritative | Stripe confirms a positive payment on the initial subscription invoice. |
| `subscription_cancelled` | server authoritative | Stripe webhook records a pending-cancel transition. |
| `credit_top_up_checkout_started` | server best-effort | Credit top-up checkout session created. |
| `credits_purchased` | server authoritative | Paid top-up ledger entry newly created. |
| `credits_consumed` | server best-effort | Credit Lab spend succeeds. |
| `credits_exhausted` | server best-effort | Credit Lab spend fails for insufficient credits. |

`subscription_changed` and `subscription_ended` are typed but not emitted in v1.
The current hooks do not expose a clean durable retry-safe transition for those
events. Add a small Stripe processed-event marker before emitting them.

## Idempotency

Stripe webhook replay can enqueue the same billing event safely. The queue
deduplicates purchases by Checkout Session, starts by Stripe subscription,
and scheduled cancellations by Stripe event. Failed sends stay queued with
backoff. Successful sends retain the deduplication key and clear the payload.

Run the Drizzle migration before starting the web app. The queue worker runs
inside the long-lived Next.js Node process used by the standalone deployment.
Subscribe the Stripe endpoint to `invoice.paid` to record paid subscription
starts. If Umami accepts a request but its response is lost, retrying the
event may count it twice. Stripe and the credit ledger provide exact totals.

## Staging verification

Use a staging Umami website ID and Stripe test mode. Open a campaign URL in
a fresh browser session, sign up, and complete a paid subscription through the
post-signup checkout flow. In Umami, confirm that `signup_completed`,
`subscription_checkout_started`, and `subscription_started` each appear once
with the same campaign fields and Distinct ID. Repeat with direct checkout and
Google sign-in. Confirm that an email-list submission requiring verification
appears only after the confirmation link is used.

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
| Server best-effort | Non-financial server telemetry that can be fire-and-forget. | `void analytics.track(...)` from `@/adapters/analytics/server` |
| Server authoritative | Revenue, purchase, subscription, or lifecycle events. | `await queueBillingAnalytics(...)` from the billing analytics service |

Prefer the durable business transition over a broad UI trigger. For example,
emit a purchase event from the webhook or ledger write that proves the purchase
happened, not from the button click that starts checkout.

### 2. Type The Event

Add the event to exactly one map in `src/adapters/analytics/events.ts`.

Use `undefined` for events with no properties:

```ts
export type ServerBestEffortEventMap = {
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

Queue billing events from the webhook with a stable business key so webhook
replay can recover an interrupted enqueue. Pass the Stripe event time and
set the internal user ID in `context.distinctId`. Use a pathname for
`context.url`.

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
