import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";
import { evaluateAdminAccess } from "@/lib/auth/admin-access";
import { getCurrentUser } from "@/lib/auth/current-user";
import { observeRequest } from "@/server/operations/request-observability";

const handlers = toNextJsHandler(auth.handler);

async function handleAdminRequest(
  request: Request,
  handler: typeof handlers.GET,
) {
  if (new URL(request.url).pathname.startsWith("/api/auth/admin/")) {
    const user = await getCurrentUser({ headers: request.headers });
    const decision = await evaluateAdminAccess(user);

    if (
      !decision.allowed &&
      decision.reason === "email-verification-required"
    ) {
      return Response.json({ message: decision.message }, { status: 403 });
    }

    if (!decision.allowed && decision.reason === "two-factor-required") {
      return Response.json({ message: decision.message }, { status: 403 });
    }
  }

  return handler(request);
}

export function GET(request: Request) {
  return observeRequest(request, (observedRequest) =>
    handleAdminRequest(observedRequest, handlers.GET),
  );
}

export function POST(request: Request) {
  return observeRequest(request, (observedRequest) =>
    handleAdminRequest(observedRequest, handlers.POST),
  );
}
