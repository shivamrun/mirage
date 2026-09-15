import type { AccountMutationError } from "@/server/account/results";

type StatusFunction = {
  (code: 400, response: { message: string }): unknown;
  (code: 403, response: { message: string }): unknown;
  (code: 409, response: { message: string }): unknown;
  (code: 429, response: { message: string }): unknown;
  (code: 503, response: { message: string }): unknown;
};

type ResponseSet = {
  headers: Record<string, number | string>;
};

function getAccountErrorStatusCode(code: AccountMutationError["code"]) {
  switch (code) {
    case "conflict":
      return 409;
    case "delivery-failed":
    case "unavailable":
      return 503;
    case "forbidden":
      return 403;
    case "rate-limited":
      return 429;
    case "invalid":
      return 400;
  }
}

export function accountErrorResponse({
  error,
  set,
  status,
}: {
  error: AccountMutationError;
  set: ResponseSet;
  status: StatusFunction;
}): { message: string } {
  if (error.code === "rate-limited" && error.retryAfterSeconds) {
    set.headers["Retry-After"] = String(error.retryAfterSeconds);
  }

  switch (getAccountErrorStatusCode(error.code)) {
    case 400:
      return status(400, { message: error.message }) as { message: string };
    case 403:
      return status(403, { message: error.message }) as { message: string };
    case 409:
      return status(409, { message: error.message }) as { message: string };
    case 429:
      return status(429, { message: error.message }) as { message: string };
    case 503:
      return status(503, { message: error.message }) as { message: string };
  }
}
