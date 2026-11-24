import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { admin, captcha, twoFactor } from "better-auth/plugins";
import {
  type AnalyticsAttribution,
  signupAttributionCookie,
  signupAttributionHeader,
} from "@/adapters/analytics/events";
import { analytics } from "@/adapters/analytics/server";
import { authStripePlugin } from "@/adapters/better-auth-stripe-plugin";
import { logEmailDeliveryFailure } from "@/adapters/email";
import {
  authAnalyticsPlugin,
  authHooks,
} from "@/features/auth/better-auth/hooks";
import { authAccessControl, authRolePermissions } from "@/features/auth/roles";
import { createAuthDatabaseAdapter } from "@/server/db/dal/auth";
import {
  notify,
  notifyBestEffort,
} from "@/server/db/services/notifications/service";
import { env } from "@/shared/env";
import { siteConfig } from "@/shared/metadata";
import { analyticsAttributionSchema } from "@/shared/schemas/analytics";

export const isGoogleAuthConfigured = Boolean(
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET,
);

const authCaptchaPlugins =
  env.NODE_ENV === "test"
    ? []
    : [
        captcha({
          allowedHostnames: [new URL(env.NEXT_PUBLIC_BASE_URL).hostname],
          endpoints: [
            "/sign-up/email",
            "/sign-in/email",
            "/request-password-reset",
            "/reset-password",
          ],
          expectedAction: "auth",
          provider: "cloudflare-turnstile",
          secretKey: env.TURNSTILE_SECRET_KEY,
        }),
      ];

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
      disableImplicitLinking: true,
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
        async after(user, context) {
          if (
            context?.path === "/sign-up/email" ||
            context?.path === "/callback/:id"
          ) {
            let attribution: AnalyticsAttribution | undefined;
            try {
              const header = context.headers?.get(signupAttributionHeader);
              const attributionJson = header
                ? decodeURIComponent(header)
                : context.getCookie(signupAttributionCookie);
              if (attributionJson) {
                const parsed = analyticsAttributionSchema.safeParse(
                  JSON.parse(attributionJson),
                );
                if (parsed.success) attribution = parsed.data;
              }
            } catch {
              // Ignore malformed campaign data.
            }
            void analytics.track(
              "signup_completed",
              { attribution },
              {
                context: { distinctId: user.id },
              },
            );
          }
          void notifyBestEffort(
            {
              data: {
                email: user.email,
                name: user.name,
              },
              idempotencyKey: `auth:welcome:${user.id}`,
              recipientId: user.id,
              type: "auth.welcome",
            },
            "auth.welcome",
          );
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    revokeSessionsOnPasswordReset: true,
    async sendResetPassword({ url, user }) {
      try {
        await notify({
          data: {
            email: user.email,
            name: user.name,
            resetUrl: url,
          },
          recipientId: user.id,
          type: "auth.password_reset",
        });
      } catch (error) {
        logEmailDeliveryFailure("auth-password-reset", error);
        throw error;
      }
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    async sendVerificationEmail({ url, user }) {
      try {
        await notify({
          data: {
            email: user.email,
            name: user.name,
            verificationUrl: url,
          },
          recipientId: user.id,
          type: "auth.email_verification",
        });
      } catch (error) {
        logEmailDeliveryFailure("auth-email-verification", error);
        throw error;
      }
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
    ...authCaptchaPlugins,
    authStripePlugin,
    authAnalyticsPlugin,
    nextCookies(),
  ],
});
