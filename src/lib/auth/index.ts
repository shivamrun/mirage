import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";

import { invite } from "@/lib/auth/better-invite-plugin";
import { authHooks } from "@/lib/auth/hooks";
import { authAccessControl, authRolePermissions } from "@/lib/auth/roles";
import { env } from "@/lib/env";
import { createAuthDatabaseAdapter } from "@/server/db/dal/auth";
import {
  sendVerificationEmail as sendAuthVerificationEmail,
  sendPasswordResetEmail,
  sendRoleInviteEmail,
  sendWelcomeEmail,
} from "@/server/email";

export const isGoogleAuthConfigured = Boolean(
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET,
);

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.NEXT_PUBLIC_BASE_URL],
  account: {
    accountLinking: {
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
    invite({
      defaultRedirectAfterUpgrade: "/welcome",
      defaultRedirectToSignIn: `/login?callbackURL=${encodeURIComponent(
        "/welcome",
      )}`,
      defaultRedirectToSignUp: `/register?callbackURL=${encodeURIComponent(
        "/welcome",
      )}`,
      invitationTokenExpiresIn: 60 * 60 * 24 * 7,
      canCreateInvite: ({ invitedUser, inviterUser }) =>
        inviterUser.emailVerified === true &&
        inviterUser.role?.split(",").includes("admin") === true &&
        ["creator", "moderator"].includes(invitedUser.role) &&
        Boolean(invitedUser.email),
      async sendUserInvitation({ email, name, role, url }) {
        await sendRoleInviteEmail({
          email,
          inviteUrl: url,
          name,
          role,
        });
      },
    }),
    nextCookies(),
  ],
});
