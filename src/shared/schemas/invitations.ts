import { z } from "zod";

import { authRoles } from "@/features/auth/roles";
import { emailSchema } from "./helpers";
import { paginationMetaSchema } from "./pagination";

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

export type InvitationPersistedStatus = z.infer<
  typeof invitationPersistedStatusSchema
>;
export type InvitationEffectiveStatus = z.infer<
  typeof invitationEffectiveStatusSchema
>;
export type InvitationRole = z.infer<typeof invitationRoleSchema>;
export type AdminInvitationResponse = z.infer<
  typeof adminInvitationResponseSchema
>;
