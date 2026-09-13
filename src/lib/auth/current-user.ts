import { auth } from "@/lib/auth";
import { type AuthRole, normalizeRoles } from "@/lib/auth/roles";
import { type AuthUserRecord, getAuthUserById } from "@/server/db/dal/auth";

export type RequestHeaders = Headers;
export type { AuthRole };
export type AuthSession = typeof auth.$Infer.Session;

export type CurrentUser = AuthUserRecord & {
  roles: AuthRole[];
};

export type CurrentUserOptions = {
  headers: RequestHeaders;
};

export function getAllowedRoles(user: Pick<AuthUserRecord, "role">) {
  return normalizeRoles(user.role);
}

export async function getCurrentUser({
  headers,
}: CurrentUserOptions): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({
    headers,
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
