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

export const authRoles = ["user", "admin"] as const;

export type AuthRole = (typeof authRoles)[number];

const authRoleAccessControl = createAccessControl(defaultStatements);

export const authAccessControl = authRoleAccessControl as AccessControl;

export const authRolePermissions = {
  user: userAc,
  admin: adminAc,
} satisfies Record<AuthRole, Role>;
