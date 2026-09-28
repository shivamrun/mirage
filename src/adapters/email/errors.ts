export class EmailConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailConfigurationError";
  }
}

export class EmailDeliveryError extends Error {
  readonly providerError: unknown;

  constructor(message: string, providerError?: unknown) {
    super(message);
    this.name = "EmailDeliveryError";
    this.providerError = providerError;
  }
}

type ErrorDiagnostics = {
  errorCodes: string[];
  errorNames: string[];
  failureKind:
    | "configuration"
    | "provider-rejected"
    | "provider-response-incomplete"
    | "timeout"
    | "unknown";
};

function errorObject(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function errorCode(value: unknown) {
  const object = errorObject(value);
  const code = object?.code;

  return typeof code === "string" && code ? code : null;
}

function errorName(value: unknown) {
  if (value instanceof Error) {
    return value.name;
  }

  const object = errorObject(value);
  const name = object?.name;

  return typeof name === "string" && name ? name : null;
}

function nestedErrors(value: unknown) {
  const object = errorObject(value);
  const errors = object?.errors;
  const cause = object?.cause;

  return [
    ...(cause ? [cause] : []),
    ...(Array.isArray(errors) ? errors : []),
    ...(value instanceof EmailDeliveryError && value.providerError
      ? [value.providerError]
      : []),
  ];
}

function collectErrorDiagnostics(error: unknown): ErrorDiagnostics {
  const seen = new Set<unknown>();
  const errorCodes = new Set<string>();
  const errorNames = new Set<string>();

  function visit(value: unknown) {
    if (!value || seen.has(value)) return;

    seen.add(value);

    const code = errorCode(value);
    if (code) errorCodes.add(code);

    const name = errorName(value);
    if (name) errorNames.add(name);

    for (const nestedError of nestedErrors(value)) {
      visit(nestedError);
    }
  }

  visit(error);

  const hasTimeoutSignal =
    errorNames.has("AbortError") ||
    errorNames.has("TimeoutError") ||
    errorCodes.has("ETIMEDOUT") ||
    errorCodes.has("UND_ERR_CONNECT_TIMEOUT") ||
    errorCodes.has("UND_ERR_HEADERS_TIMEOUT") ||
    errorCodes.has("UND_ERR_BODY_TIMEOUT");

  return {
    errorCodes: [...errorCodes].sort(),
    errorNames: [...errorNames].sort(),
    failureKind:
      error instanceof EmailConfigurationError
        ? "configuration"
        : hasTimeoutSignal
          ? "timeout"
          : error instanceof EmailDeliveryError
            ? error.providerError
              ? "provider-rejected"
              : "provider-response-incomplete"
            : "unknown",
  };
}

export function logEmailDeliveryFailure(flow: string, error: unknown) {
  const diagnostics = collectErrorDiagnostics(error);

  // Do not log provider messages or the email payload: they may contain
  // addresses, codes, or one-time links.
  console.error("Email delivery could not be confirmed.", {
    flow,
    ...diagnostics,
  });
}
