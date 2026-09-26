import { Elysia } from "elysia";
import {
  compactAnalyticsAttribution,
  normalizeAnalyticsCurrency,
} from "@/adapters/analytics/events";
import { analytics } from "@/adapters/analytics/server";
import { billingCatalog } from "@/server/db/services/billing/catalog";
import { createBillingCheckoutSession } from "@/server/db/services/billing/checkout";
import { elysiaAuth } from "@/server/http/auth";
import { requestPolicy } from "@/server/http/request-policy";
import {
  billingCheckoutRequestSchema,
  billingCheckoutResponseSchema,
  messageResponseSchema,
} from "@/shared/schemas";

export const billingRoutes = new Elysia({ prefix: "/billing" })
  .use(elysiaAuth)
  .use(requestPolicy)
  .post(
    "/checkout",
    async ({ body, status, user }) => {
      try {
        const stripeCustomerId =
          "stripeCustomerId" in user &&
          typeof user.stripeCustomerId === "string"
            ? user.stripeCustomerId
            : null;

        const checkoutSession = await createBillingCheckoutSession({
          ...body,
          attribution: compactAnalyticsAttribution(body.attribution),
          customerEmail: user.email,
          stripeCustomerId,
          userId: user.id,
        });

        if (!checkoutSession.url) {
          return status(502, {
            message: "Stripe did not return a checkout URL.",
          });
        }

        void analytics.track(
          "credit_top_up_checkout_started",
          {
            attribution: compactAnalyticsAttribution(body.attribution),
            amountCents: billingCatalog.creditTopUp.amount,
            credits: billingCatalog.creditTopUp.credits,
            currency: normalizeAnalyticsCurrency(
              billingCatalog.creditTopUp.currency,
            ),
          },
          {
            context: { distinctId: user.id, url: "/billing" },
          },
        );

        return { url: checkoutSession.url };
      } catch (error) {
        console.error("Unable to create billing checkout session:", error);
        return status(502, {
          message: "Billing checkout could not be started.",
        });
      }
    },
    {
      auth: true,
      body: billingCheckoutRequestSchema,
      routeLimit: "billing-checkout",
      response: {
        200: billingCheckoutResponseSchema,
        400: messageResponseSchema,
        401: messageResponseSchema,
        403: messageResponseSchema,
        500: messageResponseSchema,
        502: messageResponseSchema,
      },
      sameOrigin: true,
    },
  );
