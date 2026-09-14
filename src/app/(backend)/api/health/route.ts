import { observeRequest } from "@/server/operations/request-observability";
import { app } from "@/server/routes";

export const GET = (request: Request) =>
  observeRequest(request, (observedRequest) => app.fetch(observedRequest));
