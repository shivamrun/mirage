import { Elysia } from "elysia";

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
          customerEmail: user.email,
          stripeCustomerId,
          userId: user.id,
        });

        if (!checkoutSession.url) {
          return status(502, {
            message: "Stripe did not return a checkout URL.",
          });
        }

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
