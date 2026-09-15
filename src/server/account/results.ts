export type AccountErrorCode =
  | "delivery-failed"
  | "forbidden"
  | "invalid"
  | "rate-limited"
  | "unavailable"
  | "conflict";

export type AccountMutationError = {
  code: AccountErrorCode;
  kind: "error";
  message: string;
  recovery?: "try-delivered-code";
  retryAfterSeconds?: number;
};

export type AccountMutationResult<T extends object = object> =
  | AccountMutationError
  | ({ kind: "success" } & T);
