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

function optionalBooleanFlagSchema() {
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
        return undefined;
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
    DB_POOL_MAX: z.coerce.number().int().min(1).max(100).optional(),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    EMAIL_FROM: optionalEnvString,
    EMAIL_REPLY_TO: optionalEnvString,
    JOBS_REDIS_URL: optionalEnvString,
    REDIS_KEY_PREFIX: z
      .preprocess((value) => {
        if (typeof value === "string" && value.trim() === "") {
          return undefined;
        }

        return value;
      }, z.string().min(1).optional())
      .transform((value) => value ?? `mirage:${process.env.NODE_ENV}`),
    REDIS_URL: optionalEnvString,
    TRUSTED_CLIENT_IP_HEADER: z
      .enum(["cf-connecting-ip", "forwarded", "x-forwarded-for", "x-real-ip"])
      .optional(),
    AWS_UPLOAD_ACCESS_KEY_ID: optionalEnvString,
    AWS_UPLOAD_BUCKET: optionalEnvString,
    AWS_UPLOAD_REGION: optionalEnvString,
    AWS_UPLOAD_SECRET_ACCESS_KEY: optionalEnvString,
    AWS_UPLOAD_SESSION_TOKEN: optionalEnvString,
    GOOGLE_CLIENT_ID: optionalEnvString,
    GOOGLE_CLIENT_SECRET: optionalEnvString,
    RESEND_API_KEY: optionalEnvString,
    STRIPE_SECRET_KEY: z.string().min(1),
    STRIPE_WEBHOOK_SECRET: z.string().min(1),
    TURNSTILE_SECRET_KEY: z.string().min(1),
    UMAMI_HOST_URL: z.url().optional(),
  },
  client: {
    NEXT_PUBLIC_BASE_URL: z.url(),
    NEXT_PUBLIC_UMAMI_DOMAINS: optionalEnvString,
    NEXT_PUBLIC_UMAMI_ENABLED: optionalBooleanFlagSchema(),
    NEXT_PUBLIC_UMAMI_SCRIPT_URL: z.url().optional(),
    NEXT_PUBLIC_UMAMI_WEBSITE_ID: optionalEnvString,
    NEXT_PUBLIC_UPLOAD_BASE_URL: optionalEnvString,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    DB_POOL_MAX: process.env.DB_POOL_MAX,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    AWS_UPLOAD_ACCESS_KEY_ID: process.env.AWS_UPLOAD_ACCESS_KEY_ID,
    AWS_UPLOAD_BUCKET: process.env.AWS_UPLOAD_BUCKET,
    AWS_UPLOAD_REGION: process.env.AWS_UPLOAD_REGION,
    AWS_UPLOAD_SECRET_ACCESS_KEY: process.env.AWS_UPLOAD_SECRET_ACCESS_KEY,
    AWS_UPLOAD_SESSION_TOKEN: process.env.AWS_UPLOAD_SESSION_TOKEN,
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO,
    JOBS_REDIS_URL: process.env.JOBS_REDIS_URL,
    REDIS_KEY_PREFIX: process.env.REDIS_KEY_PREFIX,
    REDIS_URL: process.env.REDIS_URL,
    TRUSTED_CLIENT_IP_HEADER: process.env.TRUSTED_CLIENT_IP_HEADER,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
    UMAMI_HOST_URL: process.env.UMAMI_HOST_URL,
    NEXT_PUBLIC_UPLOAD_BASE_URL: process.env.NEXT_PUBLIC_UPLOAD_BASE_URL,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    NEXT_PUBLIC_UMAMI_DOMAINS: process.env.NEXT_PUBLIC_UMAMI_DOMAINS,
    NEXT_PUBLIC_UMAMI_ENABLED: process.env.NEXT_PUBLIC_UMAMI_ENABLED,
    NEXT_PUBLIC_UMAMI_SCRIPT_URL: process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL,
    NEXT_PUBLIC_UMAMI_WEBSITE_ID: process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID,
  },
});

export const getEnvVariable = (key: string) => {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }

  return value;
};
