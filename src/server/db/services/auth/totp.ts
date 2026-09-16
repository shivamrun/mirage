import { createOTP } from "@better-auth/utils/otp";

export const TOTP_DIGITS = 6;
export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_WINDOW_STEPS = 1;

function normalizeTotpCode(code: string) {
  return code.replace(/\s/g, "");
}

export async function verifyTotpCode(secret: string, code: string) {
  const normalizedCode = normalizeTotpCode(code);

  if (!/^\d{6}$/.test(normalizedCode)) {
    return false;
  }

  return createOTP(secret, {
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD_SECONDS,
  }).verify(normalizedCode, { window: TOTP_WINDOW_STEPS });
}
