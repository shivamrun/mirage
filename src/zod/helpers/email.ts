import { z } from "zod";

const MAX_EMAIL_LENGTH = 254;

function hasControlCharacters(value: string) {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);

    return code <= 31 || code === 127;
  });
}

export function normalizeEmail(email: string) {
  return email.trim().normalize("NFKC").toLowerCase();
}

export const emailSchema = z
  .string()
  .transform(normalizeEmail)
  .pipe(
    z
      .email()
      .max(MAX_EMAIL_LENGTH)
      .refine((email) => !hasControlCharacters(email), {
        message: "Email cannot contain control characters.",
      }),
  );
