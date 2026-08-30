import { Elysia } from "elysia";

import { auth } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth/access";

export type AuthSession = typeof auth.$Infer.Session;

export const elysiaAuth = new Elysia({ name: "better-auth" }).macro({
  auth: {
    async resolve({ request, status }) {
      const authSession = await auth.api.getSession({
        headers: request.headers,
        query: {
          disableCookieCache: true,
        },
      });

      if (!authSession) {
        return status(401, { message: "Unauthorized" });
      }

      return {
        authSession,
        session: authSession.session,
        user: authSession.user,
      };
    },
  },
  admin: {
    async resolve({ request, status }) {
      const authUser = await getCurrentUser({
        headers: request.headers,
      });

      if (!authUser) {
        return status(404, { message: "Not Found" });
      }

      if (!authUser.roles.includes("admin")) {
        return status(404, { message: "Not Found" });
      }

      return { authUser };
    },
  },
});
