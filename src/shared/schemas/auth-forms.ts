import { z } from "zod";

import { authRoles } from "@/features/auth/roles";
import { isUploadKey } from "@/features/uploads";

import { emailSchema } from "./helpers";

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password must be 128 characters or fewer.");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required."),
});

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(100, "Name must be 100 characters or fewer."),
  email: emailSchema,
  password: passwordSchema,
  agreeToTerms: z.boolean().refine((value) => value, {
    message: "You must agree before creating an account.",
  }),
});

export const registerFormSchema = registerSchema.omit({ name: true });

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const requestPasswordResetSchema = forgotPasswordSchema.extend({
  redirectTo: z.url().optional(),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Reset token is required."),
    password: passwordSchema,
    confirmPassword: passwordSchema,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const sendVerificationEmailSchema = z.object({
  callbackURL: z.string().min(1).optional(),
  email: emailSchema,
});

export const changeEmailSchema = z.object({
  newEmail: emailSchema,
  callbackURL: z.string().min(1).optional(),
});

export const emailChangeTokenSchema = z.object({
  token: z.string().min(1, "Email change token is required."),
});

export const imageKeySchema = z
  .string()
  .trim()
  .max(2048, "Image key must be 2048 characters or fewer.")
  .refine((value) => value === "" || isUploadKey(value), {
    message: "Image must be a valid uploaded file key.",
  })
  .transform((value) => value || null);

export const accountProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(100, "Name must be 100 characters or fewer."),
  image: imageKeySchema,
});

export const adminUserNameUpdateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(100, "Name must be 100 characters or fewer."),
});

export const adminUserEmailUpdateSchema = z.object({
  email: emailSchema,
});

export const adminUserImageUpdateSchema = z.object({
  image: imageKeySchema,
});

export const adminUserBanSchema = z.object({
  banReason: z
    .string()
    .trim()
    .max(500, "Ban reason must be 500 characters or fewer.")
    .transform((value) => value || undefined),
  banExpiresInDays: z.preprocess(
    (value) => {
      if (typeof value === "string" && value.trim() === "") {
        return undefined;
      }

      return typeof value === "string" ? Number(value) : value;
    },
    z
      .number({
        error: "Ban duration must be a number.",
      })
      .int("Ban duration must use whole days.")
      .min(1, "Ban duration must be at least 1 day.")
      .max(3650, "Ban duration must be 3650 days or fewer.")
      .optional(),
  ),
});

export const adminUserPasswordUpdateSchema = z
  .object({
    newPassword: passwordSchema,
    confirmPassword: passwordSchema,
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

const authRoleSchema = z.enum(authRoles);

export const adminUserCreateSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(100, "Name must be 100 characters or fewer."),
  roles: z.array(authRoleSchema).min(1, "Select at least one role."),
});

export const adminUserRoleUpdateSchema = z.object({
  roles: z.array(authRoleSchema).min(1, "Select at least one role."),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: passwordSchema,
    confirmPassword: passwordSchema,
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const authResetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required."),
  newPassword: passwordSchema,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Verification token is required."),
});

export type LoginInput = z.input<typeof loginSchema>;
export type LoginValues = z.output<typeof loginSchema>;
export type RegisterInput = z.input<typeof registerSchema>;
export type RegisterValues = z.output<typeof registerSchema>;
export type RegisterFormInput = z.input<typeof registerFormSchema>;
export type RegisterFormValues = z.output<typeof registerFormSchema>;
export type ForgotPasswordInput = z.input<typeof forgotPasswordSchema>;
export type ForgotPasswordValues = z.output<typeof forgotPasswordSchema>;
export type RequestPasswordResetInput = z.input<
  typeof requestPasswordResetSchema
>;
export type RequestPasswordResetValues = z.output<
  typeof requestPasswordResetSchema
>;
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;
export type ResetPasswordValues = z.output<typeof resetPasswordSchema>;
export type SendVerificationEmailInput = z.input<
  typeof sendVerificationEmailSchema
>;
export type SendVerificationEmailValues = z.output<
  typeof sendVerificationEmailSchema
>;
export type ChangeEmailInput = z.input<typeof changeEmailSchema>;
export type ChangeEmailValues = z.output<typeof changeEmailSchema>;
export type AccountProfileInput = z.input<typeof accountProfileSchema>;
export type AccountProfileValues = z.output<typeof accountProfileSchema>;
export type AdminUserBanInput = z.input<typeof adminUserBanSchema>;
export type AdminUserBanValues = z.output<typeof adminUserBanSchema>;
export type AdminUserCreateInput = z.input<typeof adminUserCreateSchema>;
export type AdminUserCreateValues = z.output<typeof adminUserCreateSchema>;
export type AdminUserEmailUpdateInput = z.input<
  typeof adminUserEmailUpdateSchema
>;
export type AdminUserEmailUpdateValues = z.output<
  typeof adminUserEmailUpdateSchema
>;
export type AdminUserImageUpdateInput = z.input<
  typeof adminUserImageUpdateSchema
>;
export type AdminUserImageUpdateValues = z.output<
  typeof adminUserImageUpdateSchema
>;
export type AdminUserNameUpdateInput = z.input<
  typeof adminUserNameUpdateSchema
>;
export type AdminUserNameUpdateValues = z.output<
  typeof adminUserNameUpdateSchema
>;
export type AdminUserPasswordUpdateInput = z.input<
  typeof adminUserPasswordUpdateSchema
>;
export type AdminUserPasswordUpdateValues = z.output<
  typeof adminUserPasswordUpdateSchema
>;
export type AdminUserRoleUpdateInput = z.input<
  typeof adminUserRoleUpdateSchema
>;
export type AdminUserRoleUpdateValues = z.output<
  typeof adminUserRoleUpdateSchema
>;
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;
export type ChangePasswordValues = z.output<typeof changePasswordSchema>;
export type VerifyEmailInput = z.input<typeof verifyEmailSchema>;
export type VerifyEmailValues = z.output<typeof verifyEmailSchema>;
