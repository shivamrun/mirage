import { eq } from "drizzle-orm";
import { headers as requestHeaders } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { type AuthRole, authRoles } from "@/lib/auth/roles";
import db from "@/server/db";
import { user as userTable } from "@/server/db/schema";

type RequestHeaders = Headers | Awaited<ReturnType<typeof requestHeaders>>;
type User = typeof userTable.$inferSelect;
type RoleValue = User["role"] | string[] | null | undefined;

type AccessOptions = {
  callbackUrl?: string;
  headers?: RequestHeaders;
};

export type CurrentUser = User & {
  roles: AuthRole[];
};

const authRoleSet = new Set<string>(authRoles);

function isAuthRole(role: string): role is AuthRole {
  return authRoleSet.has(role);
}

async function getHeaders(headers?: RequestHeaders) {
  return headers ?? (await requestHeaders());
}

export function normalizeRoles(role: RoleValue): AuthRole[] {
  const values = Array.isArray(role) ? role : (role ?? "user").split(",");
  const roles = values.map((value) => value.trim()).filter(isAuthRole);

  return roles.length > 0 ? Array.from(new Set(roles)) : ["user"];
}

export function getAllowedRoles(user: Pick<User, "emailVerified" | "role">) {
  if (!user.emailVerified) {
    return ["user"] satisfies AuthRole[];
  }

  return normalizeRoles(user.role);
}

export async function getCurrentUser(
  options: AccessOptions = {},
): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({
    headers: await getHeaders(options.headers),
  });

  if (!session) {
    return null;
  }

  const [user] = await db
    .select()
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1);

  if (!user) {
    return null;
  }

  return {
    ...user,
    roles: getAllowedRoles(user),
  };
}

export async function requireAuth(options: AccessOptions = {}) {
  const user = await getCurrentUser(options);

  if (!user) {
    redirect(`/login?callbackURL=${options.callbackUrl ?? "/"}`);
  }

  return user;
}

export async function requireRole(role: AuthRole, options: AccessOptions = {}) {
  const user = await getCurrentUser(options);

  if (!user || !user.roles.includes(role)) {
    notFound();
  }

  return user;
}

export async function requireAdmin(options: AccessOptions = {}) {
  return requireRole("admin", options);
}

export async function requireModerator(options: AccessOptions = {}) {
  return requireRole("moderator", options);
}

export async function requireCreator(options: AccessOptions = {}) {
  return requireRole("creator", options);
}
