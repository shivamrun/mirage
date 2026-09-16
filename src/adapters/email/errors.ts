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

export function logEmailDeliveryFailure(flow: string, error: unknown) {
  const failureKind =
    error instanceof EmailConfigurationError
      ? "configuration"
      : error instanceof EmailDeliveryError
        ? error.providerError
          ? "provider-rejected"
          : "provider-response-incomplete"
        : error instanceof Error &&
            (error.name === "AbortError" || error.name === "TimeoutError")
          ? "timeout"
          : "unknown";

  // Do not log provider messages or the email payload: they may contain
  // addresses, codes, or one-time links.
  console.error("Email delivery could not be confirmed.", {
    flow,
    failureKind,
  });
}
