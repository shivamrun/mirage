import { createHmac } from "node:crypto";

import type {
  RateLimitBucket,
  RateLimitPolicyName,
  UploadPrepareRateLimitPolicyName,
} from "@/adapters/rate-limit/types";
import { env } from "@/shared/env";

const PUBLIC_WINDOW_MS = 15 * 60 * 1000;
const EMAIL_SEND_COOLDOWN_MS = 60 * 1000;
const ROUTE_WINDOW_MS = 15 * 60 * 1000;
const UPLOAD_PREPARE_WINDOW_MS = 60 * 1000;

const publicWritePolicies = {
  contact: { perClient: 5, perDestination: 5, global: 250 },
  "email-list": { perDestination: 8, global: 500 },
} as const;

type RoutePolicyDefinition = {
  fallbackLimit?: number;
  limit: number;
  message: string;
  scope: string;
  trustedClientLimit?: number;
  windowMs: number;
};

const routePolicies: Record<RateLimitPolicyName, RoutePolicyDefinition> = {
  "account-email-mutation": {
    limit: 12,
    message: "Too many account email requests. Please try again later.",
    scope: "route:account:email-mutation",
    trustedClientLimit: 60,
    windowMs: ROUTE_WINDOW_MS,
  },
  "account-two-factor-mutation": {
    limit: 20,
    message: "Too many two-factor requests. Please try again later.",
    scope: "route:account:two-factor-mutation",
    trustedClientLimit: 80,
    windowMs: ROUTE_WINDOW_MS,
  },
  "admin-security-mutation": {
    limit: 40,
    message: "Too many admin security requests. Please try again later.",
    scope: "route:admin:security-mutation",
    trustedClientLimit: 80,
    windowMs: ROUTE_WINDOW_MS,
  },
  "billing-checkout": {
    limit: 8,
    message: "Too many checkout requests. Please try again later.",
    scope: "route:billing:checkout",
    trustedClientLimit: 40,
    windowMs: ROUTE_WINDOW_MS,
  },
  "contact-submit": {
    fallbackLimit: 500,
    limit: 30,
    message: "Too many contact submissions. Please try again later.",
    scope: "route:contact:submit",
    windowMs: ROUTE_WINDOW_MS,
  },
  "credits-sample-create": {
    limit: 60,
    message: "Too many credit sample requests. Please try again later.",
    scope: "route:credits:sample-create",
    windowMs: ROUTE_WINDOW_MS,
  },
  "email-list-signup": {
    fallbackLimit: 750,
    limit: 60,
    message: "Too many email signups. Please try again later.",
    scope: "route:email-list:signup",
    windowMs: ROUTE_WINDOW_MS,
  },
  "uploads-prepare": {
    limit: 100,
    message: "Too many upload requests. Please try again later.",
    scope: "route:uploads:prepare",
    trustedClientLimit: 200,
    windowMs: ROUTE_WINDOW_MS,
  },
};

const uploadPreparePolicies: Record<
  UploadPrepareRateLimitPolicyName,
  {
    limit: number;
    message: string;
    scope: string;
    trustedClientLimit?: number;
    windowMs: number;
  }
> = {
  avatar: {
    limit: 12,
    message: "Too many avatar upload requests. Please try again in a minute.",
    scope: "upload:prepare:avatar",
    trustedClientLimit: 60,
    windowMs: UPLOAD_PREPARE_WINDOW_MS,
  },
};

export type PublicFlow = keyof typeof publicWritePolicies;

type TrustedClientIpHeader =
  | "cf-connecting-ip"
  | "forwarded"
  | "x-forwarded-for"
  | "x-real-ip";

type RoutePolicyInput = {
  adminUserId?: null | string;
  headers: Headers;
  policy: RateLimitPolicyName;
  routeId?: string;
  userId?: null | string;
};

export function digestRateLimitIdentifier(kind: string, value: string) {
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

export function getRouteRateLimitMessage(policy: RateLimitPolicyName) {
  return routePolicies[policy].message;
}

export function getUploadPrepareRateLimitMessage(
  policy: UploadPrepareRateLimitPolicyName,
) {
  return uploadPreparePolicies[policy].message;
}

export function buildPublicWriteBuckets({
  clientIdentifier,
  destination,
  flow,
}: {
  clientIdentifier?: string | null;
  destination: string;
  flow: PublicFlow;
}): RateLimitBucket[] {
  if (flow === "contact") {
    const policy = publicWritePolicies.contact;
    const clientBucket = clientIdentifier
      ? [
          {
            identifierHash: digestRateLimitIdentifier(
              "client",
              clientIdentifier,
            ),
            limit: policy.perClient,
            scope: "public:contact:client",
            windowMs: PUBLIC_WINDOW_MS,
          },
        ]
      : [];

    return [
      ...clientBucket,
      {
        identifierHash: digestRateLimitIdentifier("email", destination),
        limit: policy.perDestination,
        scope: "public:contact:destination",
        windowMs: PUBLIC_WINDOW_MS,
      },
      {
        identifierHash: digestRateLimitIdentifier("global", flow),
        limit: policy.global,
        scope: "public:contact:global",
        windowMs: PUBLIC_WINDOW_MS,
      },
    ];
  }

  const policy = publicWritePolicies[flow];

  return [
    {
      identifierHash: digestRateLimitIdentifier("email", destination),
      limit: policy.perDestination,
      scope: `public:${flow}:destination`,
      windowMs: PUBLIC_WINDOW_MS,
    },
    {
      identifierHash: digestRateLimitIdentifier("global", flow),
      limit: policy.global,
      scope: `public:${flow}:global`,
      windowMs: PUBLIC_WINDOW_MS,
    },
  ];
}

export function buildAccountEmailSendBuckets({
  accountId,
  destination,
  flow,
  variant,
}: {
  accountId: string;
  destination: string;
  flow: "email-change" | "email-verification" | "two-factor";
  variant?: string;
}): RateLimitBucket[] {
  const identitySuffix = variant ? `:${variant}` : "";
  return [
    {
      identifierHash: digestRateLimitIdentifier(
        "account",
        `${accountId}${identitySuffix}`,
      ),
      limit: 1,
      scope: `email:${flow}:account`,
      windowMs: EMAIL_SEND_COOLDOWN_MS,
    },
    {
      identifierHash: digestRateLimitIdentifier(
        "email",
        `${destination}${identitySuffix}`,
      ),
      limit: 1,
      scope: `email:${flow}:destination`,
      windowMs: EMAIL_SEND_COOLDOWN_MS,
    },
  ];
}

export function buildRouteRateLimitBuckets({
  adminUserId,
  headers,
  policy: policyName,
  routeId = policyName,
  userId,
}: RoutePolicyInput): RateLimitBucket[] {
  const policy = routePolicies[policyName];
  const clientIdentifier = getPublicClientIdentifier(headers);
  const actorId = adminUserId ?? userId;

  if (actorId) {
    const buckets: RateLimitBucket[] = [
      {
        identifierHash: digestRateLimitIdentifier("user", actorId),
        limit: policy.limit,
        scope: `${policy.scope}:user`,
        windowMs: policy.windowMs,
      },
    ];

    if (clientIdentifier && policy.trustedClientLimit) {
      buckets.push({
        identifierHash: digestRateLimitIdentifier("client", clientIdentifier),
        limit: policy.trustedClientLimit,
        scope: `${policy.scope}:client`,
        windowMs: policy.windowMs,
      });
    }

    return buckets;
  }

  if (clientIdentifier) {
    return [
      {
        identifierHash: digestRateLimitIdentifier("client", clientIdentifier),
        limit: policy.limit,
        scope: `${policy.scope}:client`,
        windowMs: policy.windowMs,
      },
    ];
  }

  return [
    {
      identifierHash: digestRateLimitIdentifier("route", routeId),
      limit: policy.fallbackLimit ?? policy.limit,
      scope: `${policy.scope}:route`,
      windowMs: policy.windowMs,
    },
  ];
}

export function buildUploadPrepareRateLimitBuckets({
  headers,
  policy: policyName,
  userId,
}: {
  headers: Headers;
  policy: UploadPrepareRateLimitPolicyName;
  userId: string;
}): RateLimitBucket[] {
  const policy = uploadPreparePolicies[policyName];
  const clientIdentifier = getPublicClientIdentifier(headers);
  const buckets: RateLimitBucket[] = [
    {
      identifierHash: digestRateLimitIdentifier("user", userId),
      limit: policy.limit,
      scope: `${policy.scope}:user`,
      windowMs: policy.windowMs,
    },
  ];

  if (clientIdentifier && policy.trustedClientLimit) {
    buckets.push({
      identifierHash: digestRateLimitIdentifier("client", clientIdentifier),
      limit: policy.trustedClientLimit,
      scope: `${policy.scope}:client`,
      windowMs: policy.windowMs,
    });
  }

  return buckets;
}
