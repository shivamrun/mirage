import { getPublicClientIdentifier } from "@/adapters/rate-limit";
import { env } from "@/shared/env";

const TURNSTILE_SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type TurnstileVerifyResult =
  | { status: "success" }
  | { message: string; status: "failed" };

type TurnstileSiteverifyResponse = {
  action?: string;
  "error-codes"?: string[];
  hostname?: string;
  success: boolean;
};

export async function verifyTurnstileToken({
  action,
  headers,
  token,
}: {
  action: string;
  headers: Headers;
  token?: string | null;
}): Promise<TurnstileVerifyResult> {
  if (env.NODE_ENV === "test") {
    return { status: "success" };
  }

  if (!token) {
    return {
      message: "Complete the security check before submitting.",
      status: "failed",
    };
  }

  const response = await fetch(TURNSTILE_SITEVERIFY_URL, {
    body: JSON.stringify({
      response: token,
      secret: env.TURNSTILE_SECRET_KEY,
      remoteip: getPublicClientIdentifier(headers) ?? undefined,
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  if (!response.ok) {
    return {
      message: "We could not verify the security check. Please try again.",
      status: "failed",
    };
  }

  const verification = (await response.json()) as TurnstileSiteverifyResponse;
  const expectedHostname = new URL(env.NEXT_PUBLIC_BASE_URL).hostname;

  if (
    !verification.success ||
    verification.action !== action ||
    verification.hostname !== expectedHostname
  ) {
    return {
      message: "Security check failed. Please try again.",
      status: "failed",
    };
  }

  return { status: "success" };
}
