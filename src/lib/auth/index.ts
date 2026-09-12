import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { admin, twoFactor } from "better-auth/plugins";

import { authHooks } from "@/lib/auth/hooks";
import { authAccessControl, authRolePermissions } from "@/lib/auth/roles";
import { env } from "@/lib/env";
import { siteConfig } from "@/lib/metadata";
import { createAuthDatabaseAdapter } from "@/server/db/dal/auth";
import {
  sendVerificationEmail as sendAuthVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
} from "@/server/email";

export const isGoogleAuthConfigured = Boolean(
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET,
);

export const auth = betterAuth({
  appName: siteConfig.name,
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.NEXT_PUBLIC_BASE_URL],
  rateLimit: {
    enabled: env.NODE_ENV !== "development",
    storage: "database",
  },
  account: {
    accountLinking: {
      allowDifferentEmails: true,
      enabled: true,
      requireLocalEmailVerified: false,
      trustedProviders: ["google"],
    },
  },
  socialProviders: isGoogleAuthConfigured
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID as string,
          clientSecret: env.GOOGLE_CLIENT_SECRET as string,
          prompt: "select_account",
        },
      }
    : undefined,
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
  plugins: [
    admin({
      ac: authAccessControl,
      roles: authRolePermissions,
      defaultRole: "user",
    }),
    twoFactor({
      issuer: siteConfig.name,
    }),
    nextCookies(),
  ],
});
