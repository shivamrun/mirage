import { Elysia } from "elysia";

import {
  buildRouteRateLimitBuckets,
  getRouteRateLimitMessage,
} from "@/adapters/rate-limit/policies";
import { rateLimitStore } from "@/adapters/rate-limit/store";
import type { RateLimitPolicyName } from "@/adapters/rate-limit/types";
import { env } from "@/shared/env";

const trustedOrigin = new URL(env.NEXT_PUBLIC_BASE_URL).origin;

type RouteLimitOption =
  | RateLimitPolicyName
  | {
      policy: RateLimitPolicyName;
    };

function routeLimitPolicyName(option: RouteLimitOption) {
  return typeof option === "string" ? option : option.policy;
}

function isTrustedOriginRequest(request: Request) {
  const origin = request.headers.get("origin");

  if (origin) {
    return origin === trustedOrigin;
  }

  const referer = request.headers.get("referer");

  if (!referer) {
    return false;
  }

  try {
    return new URL(referer).origin === trustedOrigin;
  } catch {
    return false;
  }
}

export const requestPolicy = new Elysia({ name: "request-policy" }).macro({
  sameOrigin: {
    beforeHandle({ request, status }) {
      if (!isTrustedOriginRequest(request)) {
        return status(403, { message: "Invalid request origin." });
      }
    },
  },
  routeLimit(option: RouteLimitOption) {
    const policy = routeLimitPolicyName(option);

    return {
      async beforeHandle(context) {
        const routeContext = context as typeof context & {
          authUser?: { id: string };
          user?: { id: string };
        };
        const result = await rateLimitStore.consumePolicy(
          buildRouteRateLimitBuckets({
            adminUserId: routeContext.authUser?.id,
            headers: routeContext.request.headers,
            policy,
            routeId: routeContext.route,
            userId: routeContext.user?.id,
          }),
        );

        if (!result.allowed) {
          routeContext.set.headers["Retry-After"] = String(
            result.retryAfterSeconds,
          );

          return routeContext.status(429, {
            message: getRouteRateLimitMessage(policy),
          });
        }
      },
    };
  },
});
