import { createHmac } from "node:crypto";

import { rateLimitStore } from "@/adapters/rate-limit/store";
import type { RateLimitResult } from "@/adapters/rate-limit/types";
import { env } from "@/shared/env";

const PUBLIC_WINDOW_MS = 15 * 60 * 1000;
const EMAIL_SEND_COOLDOWN_MS = 60 * 1000;

const publicPolicies = {
  contact: { perClient: 5, perDestination: 5, global: 250 },
  "email-list": { perDestination: 8, global: 500 },
} as const;

type PublicFlow = keyof typeof publicPolicies;

function digestIdentifier(kind: string, value: string) {
  return createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(`${kind}:${value.trim().toLowerCase()}`)
    .digest("hex");
}

function headerValue(headers: Headers, name: string) {
  return headers.get(name)?.trim() || null;
}

function firstForwardedFor(value: string) {
  return value.split(",")[0]?.trim() || null;
}

function forwardedFor(value: string) {
  for (const part of value.split(";")) {
    const [key, rawValue] = part.split("=", 2);

    if (key?.trim().toLowerCase() !== "for" || !rawValue) {
      continue;
    }

    return rawValue.trim().replace(/^"|"$/g, "") || null;
  }

  return null;
}

type TrustedClientIpHeader =
  | "cf-connecting-ip"
  | "forwarded"
  | "x-forwarded-for"
  | "x-real-ip";

export function getPublicClientIdentifier(
  headers: Headers,
  trustedHeader:
    | TrustedClientIpHeader
    | undefined = env.TRUSTED_CLIENT_IP_HEADER,
) {
  if (!trustedHeader) {
    return null;
  }

  const value = headerValue(headers, trustedHeader);

  if (!value) {
    return null;
  }

  if (trustedHeader === "forwarded") {
    return forwardedFor(value);
  }

  if (trustedHeader === "x-forwarded-for") {
    return firstForwardedFor(value);
  }

  return value;
}

export async function consumePublicWriteLimit({
  clientIdentifier,
  destination,
  flow,
}: {
  clientIdentifier?: string | null;
  destination: string;
  flow: PublicFlow;
}): Promise<RateLimitResult> {
  await rateLimitStore.pruneExpired();

  if (flow === "contact") {
    const policy = publicPolicies.contact;
    const clientBucket = clientIdentifier
      ? [
          {
            identifierHash: digestIdentifier("client", clientIdentifier),
            limit: policy.perClient,
            scope: "public:contact:client",
            windowMs: PUBLIC_WINDOW_MS,
          },
        ]
      : [];

    return rateLimitStore.consumePolicy([
      ...clientBucket,
      {
        identifierHash: digestIdentifier("email", destination),
        limit: policy.perDestination,
        scope: "public:contact:destination",
        windowMs: PUBLIC_WINDOW_MS,
      },
      {
        identifierHash: digestIdentifier("global", flow),
        limit: policy.global,
        scope: "public:contact:global",
        windowMs: PUBLIC_WINDOW_MS,
      },
    ]);
  }

  const policy = publicPolicies[flow];

  // Until a hosting provider supplies a verified client-IP field, a generous
  // per-flow ceiling prevents rotating caller-supplied emails from being
  // completely unbounded without trusting spoofable forwarding headers.
  return rateLimitStore.consumePolicy([
    {
      identifierHash: digestIdentifier("email", destination),
      limit: policy.perDestination,
      scope: `public:${flow}:destination`,
      windowMs: PUBLIC_WINDOW_MS,
    },
    {
      identifierHash: digestIdentifier("global", flow),
      limit: policy.global,
      scope: `public:${flow}:global`,
      windowMs: PUBLIC_WINDOW_MS,
    },
  ]);
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
  await rateLimitStore.pruneExpired();

  const identitySuffix = variant ? `:${variant}` : "";
  return rateLimitStore.consumePolicy([
    {
      identifierHash: digestIdentifier(
        "account",
        `${accountId}${identitySuffix}`,
      ),
      limit: 1,
      scope: `email:${flow}:account`,
      windowMs: EMAIL_SEND_COOLDOWN_MS,
    },
    {
      identifierHash: digestIdentifier(
        "email",
        `${destination}${identitySuffix}`,
      ),
      limit: 1,
      scope: `email:${flow}:destination`,
      windowMs: EMAIL_SEND_COOLDOWN_MS,
    },
  ]);
}
