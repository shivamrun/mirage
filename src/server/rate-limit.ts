import { createHmac } from "node:crypto";

import { env } from "@/lib/env";
import {
  consumeRateLimit,
  pruneExpiredRateLimits,
  type RateLimitResult,
} from "@/server/db/dal/rate-limit";

const PUBLIC_WINDOW_MS = 15 * 60 * 1000;
const EMAIL_SEND_COOLDOWN_MS = 60 * 1000;

const publicPolicies = {
  contact: { perDestination: 5, global: 250 },
  "email-list": { perDestination: 8, global: 500 },
} as const;

type PublicFlow = keyof typeof publicPolicies;

function digestIdentifier(kind: string, value: string) {
  return createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(`${kind}:${value.trim().toLowerCase()}`)
    .digest("hex");
}

export async function consumePublicWriteLimit({
  destination,
  flow,
}: {
  destination: string;
  flow: PublicFlow;
}): Promise<RateLimitResult> {
  await pruneExpiredRateLimits();

  const policy = publicPolicies[flow];
  const destinationResult = await consumeRateLimit({
    identifierHash: digestIdentifier("email", destination),
    limit: policy.perDestination,
    scope: `public:${flow}:destination`,
    windowMs: PUBLIC_WINDOW_MS,
  });

  if (!destinationResult.allowed) {
    return destinationResult;
  }

  // Until a hosting provider supplies a verified client-IP field, a generous
  // per-flow ceiling prevents rotating caller-supplied emails from being
  // completely unbounded without trusting spoofable forwarding headers.
  return consumeRateLimit({
    identifierHash: digestIdentifier("global", flow),
    limit: policy.global,
    scope: `public:${flow}:global`,
    windowMs: PUBLIC_WINDOW_MS,
  });
}

export async function consumeAccountEmailSendLimit({
  accountId,
  destination,
  flow,
  variant,
}: {
  accountId: string;
  destination: string;
  flow: "email-change" | "email-verification" | "two-factor";
  variant?: string;
}): Promise<RateLimitResult> {
  await pruneExpiredRateLimits();

  const identitySuffix = variant ? `:${variant}` : "";
  const accountResult = await consumeRateLimit({
    identifierHash: digestIdentifier(
      "account",
      `${accountId}${identitySuffix}`,
    ),
    limit: 1,
    scope: `email:${flow}:account`,
    windowMs: EMAIL_SEND_COOLDOWN_MS,
  });

  if (!accountResult.allowed) {
    return accountResult;
  }

  return consumeRateLimit({
    identifierHash: digestIdentifier(
      "email",
      `${destination}${identitySuffix}`,
    ),
    limit: 1,
    scope: `email:${flow}:destination`,
    windowMs: EMAIL_SEND_COOLDOWN_MS,
  });
}
