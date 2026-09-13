import { headers as requestHeaders } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { evaluateAdminAccess } from "@/lib/auth/admin-access";
import {
  type AuthRole,
  type CurrentUser,
  type RequestHeaders as CurrentUserHeaders,
  getCurrentUser as getCurrentUserFromHeaders,
} from "@/lib/auth/current-user";

export type RequestHeaders =
  | Headers
  | Awaited<ReturnType<typeof requestHeaders>>;
export type { AuthRole };

type AccessOptions = {
  callbackUrl?: string;
  headers?: RequestHeaders;
};

export type { CurrentUser };

async function getHeaders(headers?: RequestHeaders) {
  return new Headers(
    headers ?? (await requestHeaders()),
  ) satisfies CurrentUserHeaders;
}

export async function getCurrentUser(
  options: AccessOptions = {},
): Promise<CurrentUser | null> {
  return getCurrentUserFromHeaders({
    headers: await getHeaders(options.headers),
  });
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
  const decision = await evaluateAdminAccess(user);

  if (!decision.allowed) {
    notFound();
  }

  return user;
}
