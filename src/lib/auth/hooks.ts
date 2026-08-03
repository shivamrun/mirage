import { APIError, createAuthMiddleware } from "better-auth/api";

import {
  authResetPasswordSchema,
  changeEmailSchema,
  loginSchema,
  registerSchema,
  requestPasswordResetSchema,
  sendVerificationEmailSchema,
  verifyEmailSchema,
} from "@/zod";

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
    fieldErrors: Record<string, string[] | undefined>;
  };
};

function getFirstValidationMessage(error: ValidationError) {
  const flattened = error.flatten();

  return (
    flattened.formErrors[0] ||
    Object.values(flattened.fieldErrors).flat().find(Boolean) ||
    "Invalid auth request."
  );
}

function throwValidationError(error: ValidationError): never {
  throw new APIError("BAD_REQUEST", {
    message: getFirstValidationMessage(error),
  });
}

export const authHooks = {
  before: createAuthMiddleware(async (ctx) => {
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
