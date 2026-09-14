import { evaluateAdminAccess } from "@/lib/auth/admin-access";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getMetricsSnapshot } from "@/server/operations/metrics";
import { observeRequest } from "@/server/operations/request-observability";

export const GET = (request: Request) =>
  observeRequest(request, async (observedRequest) => {
    const user = await getCurrentUser({ headers: observedRequest.headers });
    const decision = await evaluateAdminAccess(user);

    if (!decision.allowed) {
      return Response.json(
        { message: decision.message },
        { status: decision.statusCode },
      );
    }

    return Response.json(getMetricsSnapshot());
  });
