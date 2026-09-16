import { toNextJsHandler } from "better-auth/next-js";
import { observeRequest } from "@/adapters/operations/request-observability";
import { auth } from "@/server/db/services/auth/better-auth";
import {
  authPolicyDecisionToNextResponse,
  resolveNextAdminAccess,
} from "@/server/http/next-auth";

const handlers = toNextJsHandler(auth.handler);

async function handleAdminRequest(
  request: Request,
  handler: typeof handlers.GET,
) {
  if (new URL(request.url).pathname.startsWith("/api/auth/admin/")) {
    const { decision } = await resolveNextAdminAccess(request);

    const denialResponse = authPolicyDecisionToNextResponse(decision, {
      reasons: ["email-verification-required", "two-factor-required"],
    });

    if (denialResponse) {
      return denialResponse;
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
