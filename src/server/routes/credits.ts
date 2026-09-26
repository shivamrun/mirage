import { Elysia } from "elysia";

import { analytics } from "@/adapters/analytics/server";
import { creditBalanceGenerationParts } from "@/server/db/services/credits/cache";
import {
  CreditIdempotencyConflictError,
  getCreditBalance,
  getCreditBalanceCacheParts,
  InsufficientCreditsError,
  spendCredits,
} from "@/server/db/services/credits/ledger";
import { toCreditBalanceResponse } from "@/server/db/services/credits/response";
import type { AuthSession } from "@/server/http/auth";
import { elysiaAuth } from "@/server/http/auth";
import { requestPolicy } from "@/server/http/request-policy";
import { responseCache } from "@/server/http/response-cache";
import { getCreditSampleItem } from "@/shared/credits/sample-catalog";
import {
  creditBalanceResponseSchema,
  creditSampleCreateRequestSchema,
  creditSampleCreateResponseSchema,
  messageResponseSchema,
} from "@/shared/schemas";

type AuthenticatedRouteContext = {
  user: AuthSession["user"];
};

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
  .use(responseCache)
  .get(
    "/balance",
    async (context: unknown) => {
      const { user } = context as unknown as AuthenticatedRouteContext;
      const balance = await getCreditBalance(user.id);
      return toCreditBalanceResponse(balance);
    },
    {
      auth: true,
      routeCache: {
        generationParts: (context) =>
          creditBalanceGenerationParts(context.user?.id ?? ""),
        parts: (context) => getCreditBalanceCacheParts(context.user?.id ?? ""),
        policy: "apiCreditBalance",
        validator: creditBalanceResponseSchema.parse,
      },
      response: {
        200: creditBalanceResponseSchema,
        401: messageResponseSchema,
        500: messageResponseSchema,
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

        void analytics.track(
          "credits_consumed",
          {
            credits: item.credits,
            itemKey: item.key,
            source: "sample_credit_lab",
          },
          {
            context: { distinctId: user.id, url: "/credits" },
          },
        );

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
          void analytics.track(
            "credits_exhausted",
            {
              availableCredits: error.availableCredits,
              itemKey: item.key,
              requestedCredits: error.requestedCredits,
              source: "sample_credit_lab",
            },
            {
              context: { distinctId: user.id, url: "/credits" },
            },
          );

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
      routeLimit: "credits-sample-create",
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
