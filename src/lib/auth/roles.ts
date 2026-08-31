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
export type RoleValue = string | string[] | null | undefined;

const authRoleSet = new Set<string>(authRoles);

function isAuthRole(role: string): role is AuthRole {
  return authRoleSet.has(role);
}

export function normalizeRoles(role: RoleValue): AuthRole[] {
  const values = Array.isArray(role) ? role : (role ?? "user").split(",");
  const roles = values.map((value) => value.trim()).filter(isAuthRole);

  return Array.from(new Set<AuthRole>(["user", ...roles]));
}

const authRoleAccessControl = createAccessControl(defaultStatements);

export const authAccessControl = authRoleAccessControl as AccessControl;

export const authRolePermissions = {
  user: userAc,
  admin: adminAc,
} satisfies Record<AuthRole, Role>;
