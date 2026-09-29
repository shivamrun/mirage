import { z } from "zod";

import { authRoles } from "@/features/auth/roles";

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

export type InvitationPersistedStatus = z.infer<
  typeof invitationPersistedStatusSchema
>;
export type InvitationEffectiveStatus = z.infer<
  typeof invitationEffectiveStatusSchema
>;
export type InvitationRole = z.infer<typeof invitationRoleSchema>;
