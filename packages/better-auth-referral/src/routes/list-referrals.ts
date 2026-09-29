import {
  APIError,
  createAuthEndpoint,
  getSessionFromCtx,
} from "better-auth/api";
import { z } from "zod";
import { getOrCreateReferralCode, maskEmail } from "../helpers";
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

const DEFAULT_REFERRALS_LIMIT = 20;
const MAX_REFERRALS_LIMIT = 100;

const listReferralsQuerySchema = z.object({
  limit: z.string().or(z.number()).optional(),
  offset: z.string().or(z.number()).optional(),
});

function getPaginationValue(
  value: number | string | undefined,
  field: "limit" | "offset",
) {
  if (value === undefined) {
    return field === "limit" ? DEFAULT_REFERRALS_LIMIT : 0;
  }

  const parsedValue = Number(value);
  const minimumValue = field === "limit" ? 1 : 0;

  if (!Number.isInteger(parsedValue) || parsedValue < minimumValue) {
    throw new APIError("BAD_REQUEST", {
      message: `${field} must be an integer greater than or equal to ${minimumValue}.`,
    });
  }

  if (field === "limit") {
    return Math.min(parsedValue, MAX_REFERRALS_LIMIT);
  }

  return parsedValue;
}

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

      const limit = getPaginationValue(ctx.query?.limit, "limit");
      const offset = getPaginationValue(ctx.query?.offset, "offset");
      const where = [
        {
          field: "referrerUserId",
          value: session.user.id,
        },
      ];

      const referralCode = await getOrCreateReferralCode(
        dbAdapter,
        session.user.id,
      );

      const [referrals, total] = await Promise.all([
        dbAdapter.findMany({
          model: "referrals",
          where,
          select: [
            "id",
            "referredUserId",
            "status",
            "completedAt",
            "createdAt",
          ],
          limit,
          offset,
          sortBy: {
            field: "createdAt",
            direction: "desc",
          },
        }) as Promise<ReferralRecord[]>,
        dbAdapter.count({
          model: "referrals",
          where,
        }),
      ]);

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
        code: referralCode.code,
        referrals: referrals.map((referral) => {
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
        total,
        limit,
        offset,
      });
    },
  );
}
