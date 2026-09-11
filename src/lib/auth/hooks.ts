import { APIError, createAuthMiddleware } from "better-auth/api";

import {
  authResetPasswordSchema,
  changeEmailSchema,
  imageKeySchema,
  loginSchema,
  registerSchema,
  requestPasswordResetSchema,
  sendVerificationEmailSchema,
  verifyEmailSchema,
} from "@/zod";
import { emailSchema } from "@/zod/helpers";

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
