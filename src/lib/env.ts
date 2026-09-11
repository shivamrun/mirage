import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const trueEnvValues = ["1", "true", "yes", "on"] as const;
const falseEnvValues = ["0", "false", "no", "off"] as const;
const booleanFlagEnvValues = [...trueEnvValues, ...falseEnvValues] as const;
const trueEnvValueSet = new Set<string>(trueEnvValues);

const optionalEnvString = z.preprocess((value) => {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
}, z.string().min(1).optional());

function _booleanFlagSchema(defaultValue: boolean) {
  return z
    .preprocess((value) => {
      if (typeof value === "string") {
        const normalizedValue = value.trim().toLowerCase();

        return normalizedValue === "" ? undefined : normalizedValue;
      }

      return value;
    }, z.union([z.boolean(), z.enum(booleanFlagEnvValues)]).optional())
    .transform((value) => {
      if (value == null) {
        return defaultValue;
      }

      if (typeof value === "boolean") {
        return value;
      }

      return trueEnvValueSet.has(value);
    });
}

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "production", "test"]),
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    EMAIL_FROM: optionalEnvString,
    EMAIL_REPLY_TO: optionalEnvString,
    AWS_UPLOAD_ACCESS_KEY_ID: optionalEnvString,
    AWS_UPLOAD_BUCKET: optionalEnvString,
    AWS_UPLOAD_REGION: optionalEnvString,
    AWS_UPLOAD_SECRET_ACCESS_KEY: optionalEnvString,
    AWS_UPLOAD_SESSION_TOKEN: optionalEnvString,
    GOOGLE_CLIENT_ID: optionalEnvString,
    GOOGLE_CLIENT_SECRET: optionalEnvString,
    RESEND_API_KEY: optionalEnvString,
  },
  client: {
    NEXT_PUBLIC_BASE_URL: z.string().min(1),
    NEXT_PUBLIC_UPLOAD_BASE_URL: optionalEnvString,
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    AWS_UPLOAD_ACCESS_KEY_ID: process.env.AWS_UPLOAD_ACCESS_KEY_ID,
    AWS_UPLOAD_BUCKET: process.env.AWS_UPLOAD_BUCKET,
    AWS_UPLOAD_REGION: process.env.AWS_UPLOAD_REGION,
    AWS_UPLOAD_SECRET_ACCESS_KEY: process.env.AWS_UPLOAD_SECRET_ACCESS_KEY,
    AWS_UPLOAD_SESSION_TOKEN: process.env.AWS_UPLOAD_SESSION_TOKEN,
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    NEXT_PUBLIC_UPLOAD_BASE_URL: process.env.NEXT_PUBLIC_UPLOAD_BASE_URL,
  },
});

export const getEnvVariable = (key: string) => {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }

  return value;
};
