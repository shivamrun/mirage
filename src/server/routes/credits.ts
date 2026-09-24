import { Elysia } from "elysia";

import {
  CreditIdempotencyConflictError,
  getCreditBalance,
  InsufficientCreditsError,
  spendCredits,
} from "@/server/db/services/credits/ledger";
import { toCreditBalanceResponse } from "@/server/db/services/credits/response";
import { elysiaAuth } from "@/server/http/auth";
import { requestPolicy } from "@/server/http/request-policy";
import { getCreditSampleItem } from "@/shared/credits/sample-catalog";
import {
  creditBalanceResponseSchema,
  creditSampleCreateRequestSchema,
  creditSampleCreateResponseSchema,
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
