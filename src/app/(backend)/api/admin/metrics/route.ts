import { getMetricsSnapshot } from "@/adapters/operations/metrics";
import { observeRequest } from "@/adapters/operations/request-observability";
import {
  authPolicyDecisionToNextResponse,
  resolveNextAdminAccess,
} from "@/server/http/next-auth";

export const GET = (request: Request) =>
  observeRequest(request, async (observedRequest) => {
    const { decision } = await resolveNextAdminAccess(observedRequest);
    const denialResponse = authPolicyDecisionToNextResponse(decision);

    if (denialResponse) {
      return denialResponse;
    }

    return Response.json(getMetricsSnapshot());
  });
