import { randomUUID } from "node:crypto";

import { recordRequestMetric } from "./metrics";

type ObservedHandler = (request: Request) => Promise<Response> | Response;

function getRequestId(request: Request) {
  return request.headers.get("x-request-id") ?? randomUUID();
}

function logRequest(entry: Record<string, unknown>) {
  console.info(JSON.stringify({ event: "http_request", ...entry }));
}

function logRequestError(entry: Record<string, unknown>) {
  console.error(JSON.stringify({ event: "http_request_error", ...entry }));
}

function withRequestId(response: Response, requestId: string) {
  const headers = new Headers(response.headers);
  headers.set("x-request-id", requestId);

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

function jsonErrorResponse(requestId: string) {
  return withRequestId(
    Response.json({ message: "Internal server error." }, { status: 500 }),
    requestId,
  );
}

export async function observeRequest(
  request: Request,
  handler: ObservedHandler,
) {
  const requestId = getRequestId(request);
  const { pathname } = new URL(request.url);
  const startedAt = performance.now();

  try {
    const response = await handler(request);
    const durationMs = performance.now() - startedAt;
    recordRequestMetric({
      durationMs,
      method: request.method,
      pathname,
      status: response.status,
    });
    logRequest({
      durationMs: Math.round(durationMs),
      method: request.method,
      pathname,
      requestId,
      status: response.status,
    });

    return withRequestId(response, requestId);
  } catch (error) {
    const durationMs = performance.now() - startedAt;
    recordRequestMetric({
      durationMs,
      method: request.method,
      pathname,
      status: 500,
    });
    logRequestError({
      durationMs: Math.round(durationMs),
      method: request.method,
      pathname,
      requestId,
      status: 500,
      error: error instanceof Error ? error.message : String(error),
    });

    return jsonErrorResponse(requestId);
  }
}
