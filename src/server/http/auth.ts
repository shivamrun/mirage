import { Elysia } from "elysia";

import { auth } from "@/lib/auth";
import { type AuthSession, getCurrentUser } from "@/lib/auth/current-user";

export type { AuthSession };

const emailVerificationRequired = {
  message: "Email verification required",
};

const twoFactorRequired = {
  message: "Two-factor authentication required",
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
        return status(404, { message: "Not Found" });
      }

      if (!authUser.roles.includes("admin")) {
        return status(404, { message: "Not Found" });
      }

      if (!authUser.emailVerified) {
        return status(403, emailVerificationRequired);
      }

      if (!authUser.twoFactorEnabled) {
        return status(403, twoFactorRequired);
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
