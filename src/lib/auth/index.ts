import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";

import { authHooks } from "@/lib/auth/hooks";
import { env } from "@/lib/env";
import { createAuthDatabaseAdapter } from "@/server/db/dal/auth";
import {
  sendVerificationEmail as sendAuthVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
} from "@/server/email";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.NEXT_PUBLIC_BASE_URL],
  databaseHooks: {
    user: {
      create: {
        async after(user, _context) {
          void sendWelcomeEmail({
            email: user.email,
            name: user.name,
          }).catch((reason) => {
            console.error("Failed to send welcome email:", reason);
          });
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    async sendResetPassword({ url, user }) {
      await sendPasswordResetEmail({
        email: user.email,
        name: user.name,
        resetUrl: url,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    async sendVerificationEmail({ url, user }) {
      await sendAuthVerificationEmail({
        email: user.email,
        name: user.name,
        verificationUrl: url,
      });
    },
  },
  hooks: authHooks,
  database: createAuthDatabaseAdapter(),
  plugins: [nextCookies()],
});
