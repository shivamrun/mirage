import { Elysia } from "elysia";

import { env } from "@/shared/env";

const trustedOrigin = new URL(env.NEXT_PUBLIC_BASE_URL).origin;

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
});
