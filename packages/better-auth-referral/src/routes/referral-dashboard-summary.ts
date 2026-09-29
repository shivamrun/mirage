import {
  APIError,
  createAuthEndpoint,
  getSessionFromCtx,
} from "better-auth/api";
import { getOrCreateReferralCode } from "../helpers";
import { getRequiredReferralSteps } from "../progress";
import type { BetterAuthReferralOptions } from "../types";

function getTodayRange() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  return { startOfToday, startOfTomorrow };
}

export function referralDashboardSummaryRoute(
  options: BetterAuthReferralOptions,
) {
  return createAuthEndpoint(
    "/referrals",
    {
      method: "GET",
    },
    async (ctx) => {
      const session = await getSessionFromCtx(ctx);

      if (!session) {
        throw new APIError("UNAUTHORIZED", {
          message: "Authentication required.",
        });
      }

      const dbAdapter = ctx.context.adapter;

      const referralCode = await getOrCreateReferralCode(
        dbAdapter,
        session.user.id,
      );

      const { startOfToday, startOfTomorrow } = getTodayRange();

      const hasConfiguredSteps = getRequiredReferralSteps(options).length > 1;

      const [total, joinedToday, pending] = await Promise.all([
        dbAdapter.count({
          model: "referrals",
          where: [
            {
              field: "referrerUserId",
              value: session.user.id,
            },
          ],
        }),
        dbAdapter.count({
          model: "referrals",
          where: [
            {
              field: "referrerUserId",
              value: session.user.id,
            },
            {
              field: "createdAt",
              operator: "gte",
              value: startOfToday,
            },
            {
              field: "createdAt",
              operator: "lt",
              value: startOfTomorrow,
            },
          ],
        }),
        hasConfiguredSteps
          ? dbAdapter.count({
              model: "referrals",
              where: [
                {
                  field: "referrerUserId",
                  value: session.user.id,
                },
                {
                  field: "status",
                  value: "pending",
                },
              ],
            })
          : Promise.resolve(0),
      ]);

      return ctx.json({
        code: referralCode.code,
        stats: {
          completed: total - pending,
          joinedToday,
          pending,
          total,
        },
      });
    },
  );
}
