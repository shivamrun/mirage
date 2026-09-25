import { Elysia } from "elysia";

import {
  CreditIdempotencyConflictError,
  getCreditBalance,
  InsufficientCreditsError,
  spendCredits,
} from "@/server/db/services/credits/ledger";
import { toCreditBalanceResponse } from "@/server/db/services/credits/response";
import { createCreditTopUpCheckoutSession } from "@/server/db/services/credits/top-up";
import { elysiaAuth } from "@/server/http/auth";
import { requestPolicy } from "@/server/http/request-policy";
import { getCreditSampleItem } from "@/shared/credits/sample-catalog";
import { env } from "@/shared/env";
import {
  creditBalanceResponseSchema,
  creditSampleCreateRequestSchema,
  creditSampleCreateResponseSchema,
  creditTopUpCheckoutResponseSchema,
  messageResponseSchema,
} from "@/shared/schemas";

function sampleEntryForItem({
  creditsSpent,
  itemKey,
  ledgerEntryId,
  name,
}: {
  creditsSpent: number;
  itemKey: string;
  ledgerEntryId: string;
  name: string;
}) {
  return {
    body: `Created from ledger entry ${ledgerEntryId.slice(0, 8)} after spending ${creditsSpent} credits.`,
    creditsSpent,
    itemKey,
    title: `${name} created`,
  };
}

export const creditsRoutes = new Elysia({ prefix: "/credits" })
  .use(elysiaAuth)
  .use(requestPolicy)
  .get(
    "/balance",
    async ({ user }) => {
      const balance = await getCreditBalance(user.id);
      return toCreditBalanceResponse(balance);
    },
    {
      auth: true,
      response: {
        200: creditBalanceResponseSchema,
        401: messageResponseSchema,
        500: messageResponseSchema,
      },
    },
  )
  .post(
    "/top-up/checkout",
    async ({ status, user }) => {
      try {
        const baseUrl = env.NEXT_PUBLIC_BASE_URL;
        const stripeCustomerId =
          "stripeCustomerId" in user &&
          typeof user.stripeCustomerId === "string"
            ? user.stripeCustomerId
            : null;
        const checkoutSession = await createCreditTopUpCheckoutSession({
          cancelUrl: `${baseUrl}/billing?checkout=cancelled`,
          customerEmail: user.email,
          stripeCustomerId,
          successUrl: `${baseUrl}/billing?checkout=success&creditCheckoutSessionId={CHECKOUT_SESSION_ID}`,
          userId: user.id,
        });

        if (!checkoutSession.url) {
          return status(502, {
            message: "Stripe did not return a checkout URL.",
          });
        }

        return { url: checkoutSession.url };
      } catch (error) {
        console.error(
          "Unable to create credit top-up checkout session:",
          error,
        );
        return status(502, {
          message: "Credit top-up checkout could not be started.",
        });
      }
    },
    {
      auth: true,
      sameOrigin: true,
      response: {
        200: creditTopUpCheckoutResponseSchema,
        401: messageResponseSchema,
        403: messageResponseSchema,
        500: messageResponseSchema,
        502: messageResponseSchema,
      },
    },
  )
  .post(
    "/sample-create",
    async ({ body, status, user }) => {
      const item = getCreditSampleItem(body.itemKey);

      if (!item) {
        return status(400, { message: "Choose a valid credit sample item." });
      }

      try {
        const ledgerEntry = await spendCredits({
          amount: item.credits,
          idempotencyKey: body.idempotencyKey,
          source: "sample_credit_lab",
          sourceId: item.key,
          userId: user.id,
        });
        const balance = await getCreditBalance(user.id);

        return {
          balance: toCreditBalanceResponse(balance),
          created: sampleEntryForItem({
            creditsSpent: item.credits,
            itemKey: item.key,
            ledgerEntryId: ledgerEntry.id,
            name: item.name,
          }),
        };
      } catch (error) {
        if (error instanceof InsufficientCreditsError) {
          return status(402, {
            message: `Insufficient credits. Available: ${error.availableCredits}. Required: ${error.requestedCredits}.`,
          });
        }

        if (error instanceof CreditIdempotencyConflictError) {
          return status(409, {
            message:
              "This credit sample request was already submitted with different details. Please retry with a new idempotency key.",
          });
        }

        throw error;
      }
    },
    {
      auth: true,
      sameOrigin: true,
      body: creditSampleCreateRequestSchema,
      response: {
        200: creditSampleCreateResponseSchema,
        400: messageResponseSchema,
        401: messageResponseSchema,
        402: messageResponseSchema,
        403: messageResponseSchema,
        409: messageResponseSchema,
        500: messageResponseSchema,
      },
    },
  );
