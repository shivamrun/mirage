import { type AuthRole, normalizeRoles } from "@/features/auth/roles";
import { type AuthUserRecord, getAuthUserById } from "@/server/db/dal/auth";
import { auth } from "@/server/db/services/auth/better-auth";

export type RequestHeaders = Headers;
export type { AuthRole };
export type AuthSession = typeof auth.$Infer.Session;
export type SessionCookieCachePolicy = "allow" | "bypass";

export type CurrentUser = AuthUserRecord & {
  roles: AuthRole[];
  session: AuthSession["session"];
};

export type CurrentUserOptions = {
  headers: RequestHeaders;
  sessionCookieCache?: SessionCookieCachePolicy;
};

export function getAllowedRoles(user: Pick<AuthUserRecord, "role">) {
  return normalizeRoles(user.role);
}

export async function getCurrentUserFromAuthSession(
  authSession: AuthSession,
): Promise<CurrentUser | null> {
  const user = await getAuthUserById(authSession.user.id);

  if (!user) {
    return null;
  }

  return {
    ...user,
    roles: getAllowedRoles(user),
    session: authSession.session,
  };
}

export async function resolveAuthSession({
  headers,
  sessionCookieCache = "allow",
}: CurrentUserOptions): Promise<AuthSession | null> {
  return auth.api.getSession({
    headers,
    query:
      sessionCookieCache === "bypass"
        ? {
            disableCookieCache: true,
          }
        : undefined,
  });
}

export async function getCurrentUser({
  headers,
  sessionCookieCache,
}: CurrentUserOptions): Promise<CurrentUser | null> {
  const session = await resolveAuthSession({
    headers,
    sessionCookieCache,
  });

  if (!session) {
    return null;
  }

  return getCurrentUserFromAuthSession(session);
}
