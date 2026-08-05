import {
  type AccessControl,
  createAccessControl,
  type Role,
} from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  userAc,
} from "better-auth/plugins/admin/access";

export const authRoles = ["user", "creator", "admin", "moderator"] as const;

export type AuthRole = (typeof authRoles)[number];

const noAdminPermissions = {
  user: [],
  session: [],
} as const;

const authRoleAccessControl = createAccessControl(defaultStatements);

export const authAccessControl = authRoleAccessControl as AccessControl;

export const authRolePermissions = {
  user: userAc,
  creator: authRoleAccessControl.newRole(noAdminPermissions),
  admin: adminAc,
  moderator: authRoleAccessControl.newRole(noAdminPermissions),
} satisfies Record<AuthRole, Role>;
