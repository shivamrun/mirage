import type { User } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { z } from "zod";
import { completeReferralStep, getRequiredReferralSteps } from "../progress";
import type { BetterAuthReferralOptions, ReferralLifecycle } from "../types";

const markReferralStepCompleteBodySchema = z.object({
  referredUserId: z.string().min(1),
  step: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

async function getUser(ctx: { context: { adapter: unknown } }, userId: string) {
  const adapter = ctx.context.adapter as {
    findOne: (params: {
      model: string;
      select?: string[];
      where: Array<{ field: string; value: string }>;
    }) => Promise<unknown>;
  };

  return (await adapter.findOne({
    model: "user",
    where: [{ field: "id", value: userId }],
    select: [
      "id",
      "name",
      "email",
      "emailVerified",
      "image",
      "createdAt",
      "updatedAt",
    ],
  })) as User | null;
}

export function markReferralStepCompleteRoute(
  options: BetterAuthReferralOptions,
) {
  return createAuthEndpoint.serverOnly(
    {
      method: "POST",
      body: markReferralStepCompleteBodySchema,
    },
    async (ctx) => {
      const requiredSteps = getRequiredReferralSteps(options);

      if (!requiredSteps.includes(ctx.body.step)) {
        throw new APIError("BAD_REQUEST", {
          message: "Unknown referral step.",
        });
      }

      const referral = (await ctx.context.adapter.findOne({
        model: "referrals",
        where: [
          {
            field: "referredUserId",
            value: ctx.body.referredUserId,
          },
        ],
        select: [
          "id",
          "referrerUserId",
          "referredUserId",
          "status",
          "completedAt",
          "createdAt",
        ],
      })) as ReferralLifecycle | null;

      if (!referral) {
        throw new APIError("NOT_FOUND", {
          message: "Referral not found.",
        });
      }

      const [referrerUser, referredUser] = await Promise.all([
        getUser(ctx, referral.referrerUserId),
        getUser(ctx, referral.referredUserId),
      ]);

      const result = await completeReferralStep({
        adapter: ctx.context.adapter,
        metadata: ctx.body.metadata,
        options,
        referral,
        referredUser: referredUser ?? undefined,
        referrerUser: referrerUser ?? undefined,
        step: ctx.body.step,
      });

      return ctx.json(result);
    },
  );
}
