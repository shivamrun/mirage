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
