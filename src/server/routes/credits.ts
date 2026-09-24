import { Elysia } from "elysia";

import { getCreditBalance } from "@/server/db/services/credits/ledger";
import { toCreditBalanceResponse } from "@/server/db/services/credits/response";
import { elysiaAuth } from "@/server/http/auth";
import {
  creditBalanceResponseSchema,
  messageResponseSchema,
} from "@/shared/schemas";

export const creditsRoutes = new Elysia({ prefix: "/credits" })
  .use(elysiaAuth)
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
  );
