import { paginateBetterAuth } from "@evensurface/paginate-better-auth";
import {
  APIError,
  createAuthEndpoint,
  getSessionFromCtx,
} from "better-auth/api";
import { z } from "zod";
import { maskEmail } from "../helpers";
import {
  getReferralProgress,
  getRequiredReferralSteps,
  normalizeReferralStatus,
} from "../progress";
import type {
  BetterAuthReferralOptions,
  ReferralRecord,
  ReferralStepCompletionRecord,
  ReferralUser,
} from "../types";

const listReferralsQuerySchema = z.object({
  limit: z.string().or(z.number()).optional(),
  page: z.string().or(z.number()).optional(),
});

export function listReferralsRoute(options: BetterAuthReferralOptions) {
  return createAuthEndpoint(
    "/referrals/list-referrals",
    {
      method: "GET",
      query: listReferralsQuerySchema,
    },
    async (ctx) => {
      const session = await getSessionFromCtx(ctx);

      if (!session) {
        throw new APIError("UNAUTHORIZED", {
          message: "Authentication required.",
        });
      }

      const dbAdapter = ctx.context.adapter;

      const where = [
        {
          field: "referrerUserId",
          value: session.user.id,
        },
      ];

      const referralResult = await paginateBetterAuth<ReferralRecord>({
        adapter: dbAdapter,
        limit: ctx.query?.limit,
        model: "referrals",
        page: ctx.query?.page,
        pageSizeOptions: {
          defaultLimit: 20,
        },
        select: ["id", "referredUserId", "status", "completedAt", "createdAt"],
        sortBy: {
          field: "createdAt",
          direction: "desc",
        },
        where,
      });
      const referrals = referralResult.items;

      const referredUserIds = [
        ...new Set(referrals.map((referral) => referral.referredUserId)),
      ];
      const referralIds = referrals.map((referral) => referral.id);
      const shouldLoadSteps =
        referralIds.length > 0 && getRequiredReferralSteps(options).length > 1;

      const [referredUsers, stepCompletions] = await Promise.all([
        referredUserIds.length > 0
          ? ((await dbAdapter.findMany({
              model: "user",
              where: [
                {
                  field: "id",
                  value: referredUserIds,
                  operator: "in",
                },
              ],
              select: ["id", "name", "email", "image"],
            })) as ReferralUser[])
          : [],
        shouldLoadSteps
          ? ((await dbAdapter.findMany({
              model: "referralStepCompletion",
              where: [
                {
                  field: "referralId",
                  value: referralIds,
                  operator: "in",
                },
              ],
              select: ["referralId", "step", "completedAt"],
            })) as ReferralStepCompletionRecord[])
          : [],
      ]);

      const referredUsersById = new Map(
        referredUsers.map((user) => [user.id, user]),
      );
      const stepCompletionsByReferralId = new Map<string, string[]>();

      for (const completion of stepCompletions) {
        const steps = stepCompletionsByReferralId.get(completion.referralId);

        if (steps) {
          steps.push(completion.step);
        } else {
          stepCompletionsByReferralId.set(completion.referralId, [
            completion.step,
          ]);
        }
      }

      return ctx.json({
        items: referrals.map((referral) => {
          const referredUser = referredUsersById.get(referral.referredUserId);

          if (!referredUser) {
            throw new APIError("INTERNAL_SERVER_ERROR", {
              message: "Could not load referral details.",
            });
          }

          return {
            id: referral.id,
            completedAt: referral.completedAt ?? null,
            createdAt: referral.createdAt,
            progress: getReferralProgress({
              completedSteps:
                stepCompletionsByReferralId.get(referral.id) ?? [],
              options,
              referral,
            }),
            status: normalizeReferralStatus(referral.status),
            referredUser: {
              ...referredUser,
              email: options.maskReferredUserEmail
                ? maskEmail(referredUser.email)
                : referredUser.email,
            },
          };
        }),
        pagination: referralResult.pagination,
      });
    },
  );
}
