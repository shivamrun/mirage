import { z } from "zod";

import { authRoles } from "@/features/auth/roles";
import { emailSchema } from "./helpers";
import { paginationMetaSchema, paginationQuerySchema } from "./pagination";

export const invitationStatusValues = [
  "pending",
  "accepted",
  "revoked",
] as const;
export const invitationPersistedStatusSchema = z.enum(invitationStatusValues);
export const invitationEffectiveStatusSchema = z.enum([
  ...invitationStatusValues,
  "expired",
]);
export const invitationRoleSchema = z.enum(authRoles);

export const adminCreateInvitationSchema = z.object({
  email: z.unknown(),
  role: z.unknown().optional(),
});

export const adminInvitationsListQuerySchema = paginationQuerySchema.extend({
  effectiveStatus: invitationEffectiveStatusSchema.optional(),
});

export const adminInvitationResponseSchema = z.object({
  acceptedAt: z.iso.datetime().nullable(),
  acceptedByUserId: z.string().nullable(),
  createdAt: z.iso.datetime(),
  effectiveStatus: invitationEffectiveStatusSchema,
  email: emailSchema,
  expiresAt: z.iso.datetime(),
  id: z.string(),
  invitedByUserId: z.string(),
  revokedAt: z.iso.datetime().nullable(),
  role: invitationRoleSchema,
  status: invitationPersistedStatusSchema,
  updatedAt: z.iso.datetime(),
});

export const adminCreateInvitationResponseSchema = z.object({
  invitation: adminInvitationResponseSchema,
  status: z.literal(true),
});

export const adminInvitationsListResponseSchema = paginationMetaSchema.extend({
  invitations: z.array(adminInvitationResponseSchema),
});

export const publicInvitationValidationStatusSchema = z.enum([
  "valid",
  "invalid",
  "expired",
  "revoked",
  "accepted",
]);

export const publicInvitationValidateQuerySchema = z.object({
  token: z.string().trim().min(1),
});

export const publicInvitationValidateResponseSchema = z.object({
  email: emailSchema.optional(),
  status: publicInvitationValidationStatusSchema,
  valid: z.boolean(),
});

export const acceptInvitationSignupSchema = z.object({
  token: z.string().trim().min(1),
  email: emailSchema,
  password: z.string().min(8).max(128),
  agreeToTerms: z.boolean().refine((value) => value),
  callbackURL: z.string().trim().min(1).optional(),
});

export const acceptInvitationSignupResponseSchema = z.object({
  redirectTo: z.string(),
  status: z.literal(true),
});

export type InvitationPersistedStatus = z.infer<
  typeof invitationPersistedStatusSchema
>;
export type InvitationEffectiveStatus = z.infer<
  typeof invitationEffectiveStatusSchema
>;
export type InvitationRole = z.infer<typeof invitationRoleSchema>;
export type PublicInvitationValidationStatus = z.infer<
  typeof publicInvitationValidationStatusSchema
>;
export type AdminInvitationsListQuery = z.output<
  typeof adminInvitationsListQuerySchema
>;
export type AdminInvitationResponse = z.infer<
  typeof adminInvitationResponseSchema
>;
