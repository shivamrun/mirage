import { headers as requestHeaders } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { type AuthRole, normalizeRoles } from "@/lib/auth/roles";
import { type AuthUserRecord, getAuthUserById } from "@/server/db/dal/auth";

export type RequestHeaders =
  | Headers
  | Awaited<ReturnType<typeof requestHeaders>>;
export type { AuthRole };

type AccessOptions = {
  callbackUrl?: string;
  headers?: RequestHeaders;
};

export type CurrentUser = AuthUserRecord & {
  roles: AuthRole[];
};

async function getHeaders(headers?: RequestHeaders) {
  return headers ?? (await requestHeaders());
}

export function getAllowedRoles(user: Pick<AuthUserRecord, "role">) {
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

  const user = await getAuthUserById(session.user.id);

  if (!user) {
    return null;
  }

  return {
    ...user,
    roles: getAllowedRoles(user),
  };
}

export async function requireAuth(
  options: AccessOptions = {},
): Promise<CurrentUser> {
  const user = await getCurrentUser(options);

  if (!user) {
    redirect(`/login?callbackURL=${options.callbackUrl ?? "/"}`);
  }

  return user;
}

export async function requireRole(
  role: AuthRole,
  options: AccessOptions = {},
): Promise<CurrentUser> {
  const user = await getCurrentUser(options);

  if (!user || !user.roles.includes(role)) {
    notFound();
  }

  return user;
}

export async function requireAdmin(options: AccessOptions = {}) {
  return requireRole("admin", options);
}

export async function requireVerifiedAdmin(options: AccessOptions = {}) {
  const user = await requireAdmin(options);

  if (!user.emailVerified) {
    notFound();
  }

  return user;
}
