Add user-to-user referrals to your Better Auth app without building the infrastructure yourself.

```ts
await authClient.signUp.email(
  {
    name: "Azula Lovelace",
    email: "azula@lovelace.com",
    password: "password123",
  },
  {
    headers: {
      "x-referral-code": "MARINE00",
    },
  },
);
```

`@marinedotsh/better-auth-referral` generates unique referral codes for your users, tracks who referred whom, and gives you referral stats and referred-user data through typed Better Auth endpoints.

- Unique referral codes for every user
- Referral attribution during email and OAuth signup
- Referral counts and referred-user lists
- Configurable multi-step referral success
- Optional email masking
- Callback after a successful referred signup

## Installation

```bash
pnpm add @marinedotsh/better-auth-referral
```

Peer dependencies:

```bash
pnpm add better-auth zod
```

## Setup

Add the server plugin to your Better Auth configuration:

```ts
import { betterAuth } from "better-auth";
import { betterAuthReferral } from "@marinedotsh/better-auth-referral";

export const auth = betterAuth({
  plugins: [
    betterAuthReferral({
      maskReferredUserEmail: true,
      steps: ["email_verified", "first_purchase"],
      afterSuccessfulSignUp: async (referrerUser, referredUser) => {
        // Send notifications, run analytics, etc.
      },
      afterReferralCompleted: async ({ referrerUser, referredUser }) => {
        // Reward users, grant credits, etc.
      },
    }),
  ],
});
```

Add the client plugin:

```ts
import { createAuthClient } from "better-auth/client";
import { betterAuthReferralClient } from "@marinedotsh/better-auth-referral";

export const authClient = createAuthClient({
  plugins: [betterAuthReferralClient()],
});
```

Run your normal Better Auth database generation and migration flow after adding the plugin.

Upgrading from an earlier version requires regenerating and applying your Better Auth database schema because the `referrals` model now tracks completion state and the plugin adds `referralStepCompletion`.

## How it works

Every user gets a unique 8-character referral code.

When someone signs up with that code:

Email signup:

```ts
await authClient.signUp.email(
  {
    name: "Ada Lovelace",
    email: "ada@example.com",
    password: "password123",
  },
  {
    headers: {
      "x-referral-code": "ABCD1234",
    },
  },
);
```

OAuth signup:

```ts
await authClient.signIn.social({
  provider: "github",
  requestSignUp: true,
  additionalData: {
    "x-referral-code": "ABCD1234",
  },
});
```

The plugin:

1. Validates the referral code before signup.
2. Lets Better Auth create the new user.
3. Records who referred the new user.
4. Creates a referral code for the new user.
5. Records the automatic `sign_up` referral step.
6. Runs your configured callbacks.

If no referral code is provided, signup works normally.

## Multi-step success

By default, a referral is completed as soon as signup is recorded. When no custom steps are configured, the automatic `sign_up` step completes the referral immediately, preserving the behavior of previous versions.

For product-qualified referrals, configure the required steps and mark them complete from your backend when the real event happens:

```ts
betterAuthReferral({
  steps: ["email_verified", "first_purchase"],
  afterReferralCompleted: async ({ referrerUser, referredUser, referral }) => {
    // Grant the final referral reward once
  },
});
```

```ts
await auth.api.markReferralStepComplete({
  body: {
    referredUserId: user.id,
    step: "first_purchase",
    metadata: { orderId: "order_123" },
  },
});
```

`sign_up` is always completed automatically. `markReferralStepComplete` is a server-only Better Auth API, so call it from trusted backend code, webhooks, jobs, or event handlers.

New referrals start as `pending`. Once every required step is recorded, the referral transitions to `completed` and receives a `completedAt` timestamp.

## Referral dashboard

Get the signed-in user's referral code and referral stats:

```ts
const result = await authClient.getMyReferralDashboard();
```

```ts
{
  code: string;
  stats: {
    completed: number;
    joinedToday: number;
    pending: number;
    total: number;
  }
}
```

The endpoint requires an authenticated session and creates a referral code if the user does not already have one.

## List referrals

Get the users referred by the signed-in user:

```ts
const result = await authClient.listReferrals({
  query: {
    limit: 20,
    offset: 0,
  },
});
```

```ts
{
  code: string;
  referrals: Array<{
    id: string;
    status: "pending" | "completed";
    completedAt: Date | null;
    createdAt: Date;
    progress: {
      requiredSteps: string[];
      completedSteps: string[];
      remainingSteps: string[];
      completed: number;
      total: number;
      isCompleted: boolean;
    };
    referredUser: {
      id: string;
      name: string;
      email: string;
      image: string | null;
    };
  }>;
  total: number;
  limit: number;
  offset: number;
}
```

Pagination:

| Parameter | Default | Range   |
| --------- | ------: | ------- |
| `limit`   |    `20` | `1-100` |
| `offset`  |     `0` | `0+`    |

Results are sorted by `createdAt` in descending order.

## Options

### `maskReferredUserEmail`

```ts
betterAuthReferral({
  maskReferredUserEmail: true,
});
```

Masks referred-user email addresses in referral list responses:

```txt
j***@example.com
```

### `referralCodeKey`

```ts
betterAuthReferral({
  referralCodeKey: "x-invite-code",
});
```

Sets the key used to read referral codes. For email signup, this is the request header name. For OAuth signup, this is the key inside Better Auth's `additionalData`.

The default key is `x-referral-code`.

### `afterSuccessfulSignUp`

```ts
betterAuthReferral({
  afterSuccessfulSignUp: async (referrerUser, referredUser) => {
    // Grant credits
    // Send a notification
    // Trigger your own reward logic
  },
});
```

Runs after a referred signup has been successfully recorded.

Errors thrown by this callback are ignored and do not fail the user's signup.

### `steps`

```ts
betterAuthReferral({
  steps: ["email_verified", "first_purchase"],
});
```

Configures the required steps for a referral to become completed. The built-in `sign_up` step is always included and recorded automatically.

Step names must be unique, non-empty, trimmed strings. `sign_up` is reserved for the built-in signup step.

### `afterReferralStepCompleted`

Runs after a new referral step is recorded. Duplicate step calls are ignored and do not trigger this callback again.

### `afterReferralCompleted`

Runs once when all required referral steps have been completed. This is the safest place to grant the final referral reward.

Errors thrown by referral lifecycle callbacks are ignored and do not fail signup or the step-completion request.

```ts
type BetterAuthReferralOptions = {
  maskReferredUserEmail?: boolean;
  referralCodeKey?: string;
  steps?: string[];
  afterSuccessfulSignUp?: (
    referrerUser: User,
    referredUser: User,
  ) => Promise<void> | void;
  afterReferralStepCompleted?: (
    payload: ReferralStepCompletedPayload,
  ) => Promise<void> | void;
  afterReferralCompleted?: (
    payload: ReferralCompletedPayload,
  ) => Promise<void> | void;
};
```

## Database schema

The plugin adds three models to your Better Auth schema.

### `referralCode`

| Field       | Type     | Notes                            |
| ----------- | -------- | -------------------------------- |
| `userId`    | `string` | References `user.id`, unique     |
| `code`      | `string` | Unique 8-character referral code |
| `createdAt` | `date`   | Creation timestamp               |

### `referrals`

| Field            | Type     | Notes                      |
| ---------------- | -------- | -------------------------- |
| `referrerUserId` | `string` | User who made the referral |
| `referredUserId` | `string` | User who signed up, unique |
| `referralCodeId` | `string` | Referral code used         |
| `status`         | `string` | `pending` or `completed`   |
| `completedAt`    | `date`   | Completion timestamp       |
| `createdAt`      | `date`   | Creation timestamp         |

### `referralStepCompletion`

| Field           | Type     | Notes                                 |
| --------------- | -------- | ------------------------------------- |
| `referralId`    | `string` | Referral being progressed             |
| `step`          | `string` | Completed step name                   |
| `completionKey` | `string` | Unique idempotency key per step       |
| `metadata`      | `json`   | Optional app-provided audit metadata  |
| `completedAt`   | `date`   | Step completion timestamp             |

Run your normal Better Auth database generation and migration flow after adding the plugin.

## API reference

### Exports

```ts
import {
  betterAuthReferral,
  betterAuthReferralClient,
  signUpReferralStep,
} from "@marinedotsh/better-auth-referral";
```

```ts
import type {
  AfterReferralCompletedCallback,
  AfterReferralStepCompletedCallback,
  AfterSuccessfulSignUpCallback,
  BetterAuthReferralOptions,
  ReferralCodeDashboard,
  ReferralCompletedPayload,
  ReferralLifecycle,
  ReferralProgress,
  ReferralRecord,
  ReferralStatus,
  ReferralStepCompletedPayload,
  ReferralStepCompletionRecord,
  ReferralUser,
} from "@marinedotsh/better-auth-referral";
```

### Endpoints

| Method | Path                                     | Description                   |
| ------ | ---------------------------------------- | ----------------------------- |
| `GET`  | `/referrals`                             | Get referral code and stats   |
| `GET`  | `/referrals/list-referrals`              | List referred users           |
| `POST` | `/referrals/mark-referral-step-complete` | Mark a referral step complete |

Server-only API:

```ts
await auth.api.markReferralStepComplete({
  body: {
    referredUserId: "user-id",
    step: "first_purchase",
    metadata: { orderId: "order_123" },
  },
});
```

`markReferralStepComplete` is server-only and rejects steps that are not in the configured required-step list.

With Better Auth's default `/api/auth` base path:

```txt
GET /api/auth/referrals
GET /api/auth/referrals/list-referrals
POST /api/auth/referrals/mark-referral-step-complete
```

### Signup referral code

| Header            | Description                                 |
| ----------------- | ------------------------------------------- |
| `x-referral-code` | Optional referral code for `/sign-up/email` |

For OAuth signup, pass the referral code in `additionalData`:

```ts
await authClient.signIn.social({
  provider: "github",
  requestSignUp: true,
  additionalData: {
    "x-referral-code": "ABCD1234",
  },
});
```

OAuth referrals are only processed when `requestSignUp` is `true` and the OAuth flow creates a new user. Referral codes sent during normal OAuth sign-in are ignored.

Use `referralCodeKey` to configure a different key.

The referral code must be exactly 8 uppercase alphanumeric characters. Invalid or unknown codes cause signup to fail with `BAD_REQUEST`.
