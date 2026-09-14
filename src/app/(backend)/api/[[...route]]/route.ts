import { observeRequest } from "@/server/operations/request-observability";
import { app } from "@/server/routes";

const handler = (request: Request) =>
  observeRequest(request, (observedRequest) => app.fetch(observedRequest));

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
