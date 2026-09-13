import { Elysia } from "elysia";

import { auth } from "@/lib/auth";
import {
  adminAccessMessages,
  evaluateAdminAccess,
} from "@/lib/auth/admin-access";
import { type AuthSession, getCurrentUser } from "@/lib/auth/current-user";

export type { AuthSession };

const emailVerificationRequired = {
  message: adminAccessMessages.emailVerificationRequired,
};

const twoFactorRequired = {
  message: adminAccessMessages.twoFactorRequired,
};

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
        return status(404, { message: adminAccessMessages.notFound });
      }

      const decision = await evaluateAdminAccess(authUser);

      if (!decision.allowed) {
        return status(decision.statusCode, { message: decision.message });
      }

      return { authUser };
    },
  },
  verifiedEmail: {
    async beforeHandle({ request, status }) {
      const authUser = await getCurrentUser({
        headers: request.headers,
      });

      if (!authUser) {
        return status(401, { message: "Unauthorized" });
      }

      if (!authUser.emailVerified) {
        return status(403, emailVerificationRequired);
      }
    },
  },
  twoFactor: {
    async beforeHandle({ request, status }) {
      const authUser = await getCurrentUser({
        headers: request.headers,
      });

      if (!authUser) {
        return status(401, { message: "Unauthorized" });
      }

      if (!authUser.twoFactorEnabled) {
        return status(403, twoFactorRequired);
      }
    },
  },
});
