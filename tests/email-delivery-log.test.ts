import { describe, expect, it, vi } from "vitest";

import {
  EmailConfigurationError,
  EmailDeliveryError,
  logEmailDeliveryFailure,
} from "@/adapters/email/errors";

describe("email delivery diagnostics", () => {
  it("classifies failures without logging provider messages or tokens", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const secret = "https://example.com/confirm?token=private-token";

    try {
      logEmailDeliveryFailure(
        "email-change-confirmation",
        new EmailConfigurationError(secret),
      );
      logEmailDeliveryFailure(
        "email-change-approval",
        new EmailDeliveryError(secret, { message: secret }),
      );
      logEmailDeliveryFailure(
        "two-factor-code",
        new EmailDeliveryError(secret),
      );
      logEmailDeliveryFailure(
        "email-change-resend",
        new DOMException(secret, "TimeoutError"),
      );

      expect(log.mock.calls.map(([, details]) => details)).toEqual([
        {
          errorCodes: [],
          errorNames: ["EmailConfigurationError"],
          failureKind: "configuration",
          flow: "email-change-confirmation",
        },
        {
          errorCodes: [],
          errorNames: ["EmailDeliveryError"],
          failureKind: "provider-rejected",
          flow: "email-change-approval",
        },
        {
          errorCodes: [],
          errorNames: ["EmailDeliveryError"],
          flow: "two-factor-code",
          failureKind: "provider-response-incomplete",
        },
        {
          errorCodes: [],
          errorNames: ["TimeoutError"],
          flow: "email-change-resend",
          failureKind: "timeout",
        },
      ]);
      expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
    } finally {
      log.mockRestore();
    }
  });

  it("surfaces nested timeout codes from fetch failures", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new TypeError("fetch failed", {
      cause: new AggregateError([
        Object.assign(new Error("connect timed out"), { code: "ETIMEDOUT" }),
      ]),
    });

    try {
      logEmailDeliveryFailure("auth-email-verification", error);

      expect(log).toHaveBeenCalledWith(
        "Email delivery could not be confirmed.",
        {
          errorCodes: ["ETIMEDOUT"],
          errorNames: ["AggregateError", "Error", "TypeError"],
          failureKind: "timeout",
          flow: "auth-email-verification",
        },
      );
    } finally {
      log.mockRestore();
    }
  });
});
