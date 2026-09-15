import {
  authPolicyDecisionToNextResponse,
  resolveNextAdminAccess,
} from "@/server/http/next-auth";
import { getMetricsSnapshot } from "@/server/operations/metrics";
import { observeRequest } from "@/server/operations/request-observability";

export const GET = (request: Request) =>
  observeRequest(request, async (observedRequest) => {
    const { decision } = await resolveNextAdminAccess(observedRequest);
    const denialResponse = authPolicyDecisionToNextResponse(decision);

    if (denialResponse) {
      return denialResponse;
    }

    return Response.json(getMetricsSnapshot());
  });
