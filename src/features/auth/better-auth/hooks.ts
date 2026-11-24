import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { z } from "zod";

import { analyticsAttributionFromMetadata } from "@/adapters/analytics/events";
import { analytics } from "@/adapters/analytics/server";
import { normalizeBillingPlan } from "@/shared/billing";
import {
  authResetPasswordSchema,
  changeEmailSchema,
  imageKeySchema,
  loginSchema,
  registerSchema,
  requestPasswordResetSchema,
  sendVerificationEmailSchema,
  verifyEmailSchema,
} from "@/shared/schemas";
import { emailSchema } from "@/shared/schemas/helpers";

const loginPaths = new Set([
  "/sign-in/email",
  "/callback/:id",
  "/two-factor/verify-totp",
  "/two-factor/verify-otp",
  "/two-factor/verify-backup-code",
]);
const trackedCheckoutSchema = z.object({
  client_reference_id: z.string().nullish(),
  metadata: z.record(z.string(), z.string()).nullish(),
  mode: z.literal("subscription"),
  object: z.literal("checkout.session"),
  url: z.string().min(1),
});

export const authAnalyticsPlugin = {
  id: "mirage-analytics",
  hooks: {
    after: [
      {
        matcher: ({ path }) => Boolean(path && loginPaths.has(path)),
        handler: createAuthMiddleware(async (ctx) => {
          const userId = ctx.context.newSession?.user.id;
          const result = ctx.context.returned;

          const requiresTwoFactor =
            result &&
            typeof result === "object" &&
            "twoFactorRedirect" in result &&
            result.twoFactorRedirect === true;

          if (userId && !requiresTwoFactor) {
            void analytics.track("login_completed", {
              context: { distinctId: userId },
            });
          }
        }),
      },
      {
        matcher: ({ path }) => path === "/subscription/upgrade",
        handler: createAuthMiddleware(async (ctx) => {
          const checkout = trackedCheckoutSchema.safeParse(
            ctx.context.returned,
          );
          if (!checkout.success) return;

          const plan = normalizeBillingPlan(ctx.body?.plan);
          if (!plan || plan === "free") return;

          void analytics.track(
            "subscription_checkout_started",
            {
              attribution: analyticsAttributionFromMetadata(
                checkout.data.metadata,
              ),
              billingInterval: ctx.body?.annual ? "yearly" : "monthly",
              plan,
            },
            {
              context: {
                distinctId: checkout.data.client_reference_id ?? undefined,
                url: "/checkout",
              },
            },
          );
        }),
      },
    ],
  },
} satisfies BetterAuthPlugin;

const authInputSchemas = {
  "/sign-in/email": loginSchema,
  "/sign-up/email": registerSchema,
  "/request-password-reset": requestPasswordResetSchema,
  "/reset-password": authResetPasswordSchema,
  "/send-verification-email": sendVerificationEmailSchema,
  "/change-email": changeEmailSchema,
  "/verify-email": verifyEmailSchema,
} as const;

type ValidationError = {
  flatten: () => {
    formErrors: string[];
    fieldErrors: unknown;
  };
};

function getFirstValidationMessage(error: ValidationError) {
  const flattened = error.flatten();
  const fieldErrors =
    flattened.fieldErrors &&
    typeof flattened.fieldErrors === "object" &&
    !Array.isArray(flattened.fieldErrors)
      ? Object.values(
          flattened.fieldErrors as Record<string, string[] | undefined>,
        )
          .flat()
          .find(Boolean)
      : undefined;

  return flattened.formErrors[0] || fieldErrors || "Invalid auth request.";
}

function throwValidationError(error: ValidationError): never {
  throw new APIError("BAD_REQUEST", {
    message: getFirstValidationMessage(error),
  });
}

function parseImageUpdateValue(value: unknown) {
  return value === null
    ? imageKeySchema.safeParse("")
    : imageKeySchema.safeParse(value);
}

export const authHooks = {
  before: createAuthMiddleware(async (ctx) => {
    if (ctx.path === "/update-user" && ctx.body && "image" in ctx.body) {
      const parsed = parseImageUpdateValue(ctx.body.image);

      if (!parsed.success) {
        throwValidationError(parsed.error);
      }

      return {
        context: {
          body: {
            ...ctx.body,
            image: parsed.data,
          },
        },
      };
    }

    if (
      ctx.path === "/admin/update-user" &&
      ctx.body?.data &&
      typeof ctx.body.data === "object" &&
      "image" in ctx.body.data
    ) {
      const parsed = parseImageUpdateValue(ctx.body.data.image);

      if (!parsed.success) {
        throwValidationError(parsed.error);
      }

      return {
        context: {
          body: {
            ...ctx.body,
            data: {
              ...ctx.body.data,
              image: parsed.data,
            },
          },
        },
      };
    }

    if (ctx.path === "/reset-password") {
      const parsed = authInputSchemas["/reset-password"].safeParse({
        ...ctx.body,
        token: ctx.body?.token ?? ctx.query?.token,
      });

      if (!parsed.success) {
        throwValidationError(parsed.error);
      }

      return {
        context: {
          body: {
            ...ctx.body,
            token: parsed.data.token,
            newPassword: parsed.data.newPassword,
          },
        },
      };
    }

    if (ctx.path === "/verify-email") {
      const parsed = authInputSchemas["/verify-email"].safeParse(ctx.query);

      if (!parsed.success) {
        throwValidationError(parsed.error);
      }

      return;
    }

    if (ctx.path === "/sign-up/email") {
      const parsedEmail = emailSchema.safeParse(ctx.body?.email);
      const name = parsedEmail.success
        ? parsedEmail.data.slice(0, parsedEmail.data.indexOf("@"))
        : "";
      const parsed = registerSchema.safeParse({ ...ctx.body, name });

      if (!parsed.success) {
        throwValidationError(parsed.error);
      }

      return {
        context: {
          body: {
            ...ctx.body,
            ...parsed.data,
            name,
          },
        },
      };
    }

    const schema =
      authInputSchemas[
        ctx.path as keyof Omit<
          typeof authInputSchemas,
          "/reset-password" | "/verify-email"
        >
      ];

    if (!schema) {
      return;
    }

    const parsed = schema.safeParse(ctx.body);

    if (!parsed.success) {
      throwValidationError(parsed.error);
    }

    return {
      context: {
        body: {
          ...ctx.body,
          ...parsed.data,
        },
      },
    };
  }),
};
