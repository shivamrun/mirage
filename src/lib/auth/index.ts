import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { authHooks } from "@/lib/auth/hooks";
import { env } from "@/lib/env";
import db from "@/server/db";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.NEXT_PUBLIC_BASE_URL],
  emailAndPassword: {
    enabled: true,
    async sendResetPassword({ url, user }) {
      console.info(`Password reset link for ${user.email}: ${url}`);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    async sendVerificationEmail({ url, user }) {
      console.info(`Email verification link for ${user.email}: ${url}`);
    },
  },
  hooks: authHooks,
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  plugins: [nextCookies()],
});
