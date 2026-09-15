import { z } from "zod";

export const pendingEmailChangeSchema = z.object({
  currentEmail: z.string(),
  newEmail: z.string(),
  token: z.string(),
  userId: z.string(),
});

export type PendingEmailChange = z.infer<typeof pendingEmailChangeSchema>;

export function parsePendingEmailChange(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return pendingEmailChangeSchema.parse(JSON.parse(value));
  } catch {
    return null;
  }
}

export const twoFactorEmailCodeValueSchema = z.object({
  codeHash: z.string(),
  failedAttempts: z.number().int().min(0),
});

export type TwoFactorEmailCodeValue = z.infer<
  typeof twoFactorEmailCodeValueSchema
>;

export function createTwoFactorEmailCodeValue(
  codeHash: string,
): TwoFactorEmailCodeValue {
  return {
    codeHash,
    failedAttempts: 0,
  };
}

export function parseTwoFactorEmailCodeValue(value: string) {
  try {
    const parsed = twoFactorEmailCodeValueSchema.safeParse(JSON.parse(value));

    if (parsed.success) {
      return parsed.data;
    }
  } catch {
    // Older in-flight records stored only the code hash.
  }

  return { codeHash: value, failedAttempts: 0 };
}
