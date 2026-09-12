export type MutationError = {
  message: string;
  retryAfterSeconds?: number;
  statusCode: number;
};

export function messageResponse(message: string, status: number) {
  return Response.json({ message }, { status });
}

export function rateLimitResponse(message: string, retryAfterSeconds: number) {
  return Response.json(
    { message },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  );
}

export function mutationErrorResponse(error: MutationError) {
  if (error.statusCode === 429 && error.retryAfterSeconds) {
    return rateLimitResponse(error.message, error.retryAfterSeconds);
  }

  return messageResponse(error.message, error.statusCode);
}
