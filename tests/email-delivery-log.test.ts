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
        { flow: "email-change-confirmation", failureKind: "configuration" },
        { flow: "email-change-approval", failureKind: "provider-rejected" },
        {
          flow: "two-factor-code",
          failureKind: "provider-response-incomplete",
        },
        { flow: "email-change-resend", failureKind: "timeout" },
      ]);
      expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
    } finally {
      log.mockRestore();
    }
  });
});
