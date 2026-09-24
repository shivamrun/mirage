import { randomUUID } from "node:crypto";

import { Elysia } from "elysia";
import { z } from "zod";
import type { CurrentUser } from "@/server/db/services/auth/current-user";
import {
  adjustCredits,
  CreditIdempotencyConflictError,
  getCreditBalance,
  InsufficientCreditsError,
} from "@/server/db/services/credits/ledger";
import { toCreditBalanceResponse } from "@/server/db/services/credits/response";
import { requestPolicy } from "@/server/http/request-policy";
import {
  adminCreditAdjustmentSchema,
  creditBalanceResponseSchema,
  messageResponseSchema,
} from "@/shared/schemas";

const adminCreditAdjustmentParamsSchema = z.object({
  userId: z.string().min(1),
});

function getAdminRouteUser(context: unknown) {
  return (context as { authUser: CurrentUser }).authUser;
}

export const adminUserCreditsRoutes = new Elysia().use(requestPolicy).post(
  "/users/:userId/credits/adjust",
  async (context) => {
    const { body, params, status } = context;
    const authUser = getAdminRouteUser(context);

    try {
      await adjustCredits({
        amount: body.amount,
        idempotencyKey: body.idempotencyKey ?? randomUUID(),
        metadata: {
          actorUserId: authUser.id,
          reason: body.reason,
        },
        source: "admin_manual_adjustment",
        sourceId: body.sourceId ?? null,
        userId: params.userId,
      });

      return toCreditBalanceResponse(await getCreditBalance(params.userId));
    } catch (error) {
      if (error instanceof InsufficientCreditsError) {
        return status(400, {
          message: `Insufficient credits. Available: ${error.availableCredits}. Requested debit: ${error.requestedCredits}.`,
        });
      }
      if (error instanceof CreditIdempotencyConflictError) {
        return status(409, {
          message:
            "This credit adjustment was already submitted with different details. Please retry with a new idempotency key.",
        });
      }

      throw error;
    }
  },
  {
    sameOrigin: true,
    body: adminCreditAdjustmentSchema,
    params: adminCreditAdjustmentParamsSchema,
    response: {
      200: creditBalanceResponseSchema,
      400: messageResponseSchema,
      403: messageResponseSchema,
      409: messageResponseSchema,
      500: messageResponseSchema,
    },
  },
);
