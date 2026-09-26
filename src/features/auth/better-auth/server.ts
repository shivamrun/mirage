import { stripe } from "@better-auth/stripe";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { admin, captcha, twoFactor } from "better-auth/plugins";
import Stripe from "stripe";
import { analytics } from "@/adapters/analytics/server";
import {
  sendVerificationEmail as sendAuthVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
} from "@/adapters/email";
import { authHooks } from "@/features/auth/better-auth/hooks";
import { subscriptionPlans } from "@/features/auth/better-auth/subscription-plans";
import { authAccessControl, authRolePermissions } from "@/features/auth/roles";
import { createAuthDatabaseAdapter } from "@/server/db/dal/auth";
import type {
  BillingCheckoutInterval,
  BillingCheckoutPlan,
} from "@/server/db/services/billing/catalog";
import { reconcileCreditGrantForSubscription } from "@/server/db/services/credits/ledger";
import { env } from "@/shared/env";
import { siteConfig } from "@/shared/metadata";

export const isGoogleAuthConfigured = Boolean(
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET,
);

const stripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-08-26.dahlia",
});

function normalizeSubscriptionPlan(value: null | string | undefined) {
  const normalizedValue = value?.toLowerCase().trim();

  if (normalizedValue === "pro" || normalizedValue === "mirage pro") {
    return "pro" satisfies BillingCheckoutPlan;
  }

  if (normalizedValue === "hacker" || normalizedValue === "mirage hacker") {
    return "hacker" satisfies BillingCheckoutPlan;
  }

  return null;
}

function normalizeSubscriptionInterval(value: null | string | undefined) {
  const normalizedValue = value?.toLowerCase().trim();

  if (normalizedValue === "month" || normalizedValue === "monthly") {
    return "monthly" satisfies BillingCheckoutInterval;
  }

  if (normalizedValue === "year" || normalizedValue === "annual") {
    return "yearly" satisfies BillingCheckoutInterval;
  }

  return null;
}

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
        async after(user, _context) {
          void analytics.track("signup_completed", {
            context: { distinctId: user.id },
          });
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
    revokeSessionsOnPasswordReset: true,
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
    ...authCaptchaPlugins,
    nextCookies(),
    stripe({
      stripeClient,
      stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,
      createCustomerOnSignUp: true,
      subscription: {
        enabled: true,
        async onSubscriptionComplete({ subscription }) {
          const result =
            await reconcileCreditGrantForSubscription(subscription);
          const plan = normalizeSubscriptionPlan(subscription.plan);
          const billingInterval = normalizeSubscriptionInterval(
            subscription.billingInterval,
          );

          if (result?.grantCreated && plan && billingInterval) {
            await analytics.trackAuthoritative(
              "subscription_started",
              { billingInterval, plan },
              { context: { distinctId: subscription.referenceId } },
            );
          }
        },
        async onSubscriptionCreated({ subscription }) {
          const result =
            await reconcileCreditGrantForSubscription(subscription);
          const plan = normalizeSubscriptionPlan(subscription.plan);
          const billingInterval = normalizeSubscriptionInterval(
            subscription.billingInterval,
          );

          if (result?.grantCreated && plan && billingInterval) {
            await analytics.trackAuthoritative(
              "subscription_started",
              { billingInterval, plan },
              { context: { distinctId: subscription.referenceId } },
            );
          }
        },
        async onSubscriptionCancel({ subscription }) {
          const plan = normalizeSubscriptionPlan(subscription.plan);
          const billingInterval = normalizeSubscriptionInterval(
            subscription.billingInterval,
          );

          if (plan && billingInterval) {
            await analytics.trackAuthoritative(
              "subscription_cancelled",
              {
                billingInterval,
                cancelAtPeriodEnd: Boolean(subscription.cancelAtPeriodEnd),
                plan,
              },
              { context: { distinctId: subscription.referenceId } },
            );
          }
        },
        async onSubscriptionUpdate({ subscription }) {
          await reconcileCreditGrantForSubscription(subscription);
        },
        plans: subscriptionPlans,
      },
    }),
  ],
});
