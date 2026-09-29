import type { BetterAuthPlugin, User } from "better-auth";
import { APIError, createAuthMiddleware, getOAuthState } from "better-auth/api";
import {
  getReferralCodeKey,
  referralCodeSchema,
  tryCreateReferralCode,
} from "./helpers";
import { completeReferralStep, validateReferralSteps } from "./progress";
import { allRoutes } from "./routes";
import { betterAuthReferralSchema } from "./schema";
import {
  type BetterAuthReferralOptions,
  betterAuthReferralPluginId,
  type ReferralCodeReferrer,
  type ReferralLifecycle,
  signUpReferralStep,
} from "./types";

export type { BetterAuthReferralOptions } from "./types";
export { defaultReferralCodeKey } from "./types";

type AuthMiddlewareContext = Parameters<
  Parameters<typeof createAuthMiddleware>[0]
>[0];

const oauthReferralStartedAtKey = "__betterAuthReferralStartedAt";

type OAuthReferralBody = {
  additionalData?: Record<string, unknown>;
  requestSignUp?: boolean;
};

function parseReferralCodeValue(value: unknown, message: string) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new APIError("BAD_REQUEST", { message });
  }

  return value;
}

function parseStartedAt(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return value;
}

function getOAuthReferralBody(ctx: AuthMiddlewareContext) {
  return (ctx as { body?: OAuthReferralBody }).body;
}

function getAdditionalDataReferralCode(
  ctx: AuthMiddlewareContext,
  referralCodeKey: string,
) {
  const body = getOAuthReferralBody(ctx);

  return parseReferralCodeValue(
    body?.additionalData?.[referralCodeKey],
    "Invalid OAuth referral data.",
  );
}

function setOAuthReferralStartedAt(ctx: AuthMiddlewareContext) {
  const body = getOAuthReferralBody(ctx);

  if (!body) {
    return;
  }

  body.additionalData = {
    ...body.additionalData,
    [oauthReferralStartedAtKey]: Date.now(),
  };
}

function getOAuthBodyReferralData(
  ctx: AuthMiddlewareContext,
  referralCodeKey: string,
) {
  const body = getOAuthReferralBody(ctx);

  if (body?.requestSignUp !== true) {
    return undefined;
  }

  const code = getAdditionalDataReferralCode(ctx, referralCodeKey);
  const startedAt = parseStartedAt(
    body.additionalData?.[oauthReferralStartedAtKey],
  );

  if (!code || !startedAt) {
    return undefined;
  }

  return { code, startedAt };
}

async function getOAuthStateReferralData(referralCodeKey: string) {
  const oauthState = await getOAuthState();

  if (oauthState?.requestSignUp !== true) {
    return undefined;
  }

  const code = parseReferralCodeValue(
    oauthState[referralCodeKey],
    "Invalid OAuth referral data.",
  );
  const startedAt = parseStartedAt(oauthState[oauthReferralStartedAtKey]);

  if (!code || !startedAt) {
    return undefined;
  }

  return { code, startedAt };
}

function wasUserCreatedDuringOAuthFlow(user: User, startedAt: number) {
  const createdAt = new Date(user.createdAt).getTime();

  return Number.isFinite(createdAt) && createdAt >= startedAt;
}

async function validateReferralCode(ctx: AuthMiddlewareContext, code: string) {
  const parsedCode = referralCodeSchema.safeParse(code);

  if (!parsedCode.success) {
    throw new APIError("BAD_REQUEST", {
      message: "Invalid referral code.",
    });
  }

  const referralCode = await ctx.context.adapter.findOne({
    model: "referralCode",
    where: [
      {
        field: "code",
        value: parsedCode.data,
      },
    ],
    select: ["id"],
  });

  if (!referralCode) {
    throw new APIError("BAD_REQUEST", {
      message: "Invalid referral code.",
    });
  }
}

async function createReferral({
  ctx,
  code,
  options,
  referredUser,
}: {
  ctx: AuthMiddlewareContext;
  code: string;
  options: BetterAuthReferralOptions;
  referredUser: User;
}) {
  const parsedCode = referralCodeSchema.safeParse(code);

  if (!parsedCode.success) {
    return;
  }

  const referrerCode = (await ctx.context.adapter.findOne({
    model: "referralCode",
    where: [
      {
        field: "code",
        value: parsedCode.data,
      },
    ],
    select: ["id", "userId"],
  })) as ReferralCodeReferrer | null;

  if (!referrerCode || referrerCode.userId === referredUser.id) {
    return;
  }

  const existingReferral = await ctx.context.adapter.findOne({
    model: "referrals",
    where: [
      {
        field: "referredUserId",
        value: referredUser.id,
      },
    ],
    select: ["id"],
  });

  if (existingReferral) {
    return;
  }

  const createdReferral = (await ctx.context.adapter.create({
    model: "referrals",
    data: {
      referrerUserId: referrerCode.userId,
      referredUserId: referredUser.id,
      referralCodeId: referrerCode.id,
      status: "pending",
      completedAt: null,
    },
    select: [
      "id",
      "referrerUserId",
      "referredUserId",
      "status",
      "completedAt",
      "createdAt",
    ],
  })) as ReferralLifecycle;

  await tryCreateReferralCode(ctx.context.adapter, referredUser.id);

  const referrerUser = (await ctx.context.adapter.findOne({
    model: "user",
    where: [
      {
        field: "id",
        value: referrerCode.userId,
      },
    ],
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

  if (!referrerUser) {
    return;
  }

  await completeReferralStep({
    adapter: ctx.context.adapter,
    options,
    referral: createdReferral,
    referredUser,
    referrerUser,
    step: signUpReferralStep,
  });

  try {
    await options.afterSuccessfulSignUp?.(referrerUser, referredUser);
  } catch {
    // Post-signup callback failure should not fail a completed signup.
  }
}

export const betterAuthReferral = (options: BetterAuthReferralOptions = {}) => {
  validateReferralSteps(options);

  const referralCodeKey = getReferralCodeKey(options);

  return {
    id: betterAuthReferralPluginId,

    hooks: {
      before: [
        {
          matcher: (ctx) => ctx.path === "/sign-up/email",
          handler: createAuthMiddleware(async (ctx) => {
            const code = ctx.getHeader(referralCodeKey);

            if (!code) return;

            await validateReferralCode(ctx, code);
          }),
        },
        {
          matcher: (ctx) =>
            ctx.path === "/sign-in/social" || ctx.path === "/sign-in/oauth2",
          handler: createAuthMiddleware(async (ctx) => {
            const body = getOAuthReferralBody(ctx);

            if (body?.requestSignUp !== true) return;

            const code = getAdditionalDataReferralCode(ctx, referralCodeKey);

            if (!code) return;

            await validateReferralCode(ctx, code);
            setOAuthReferralStartedAt(ctx);
          }),
        },
      ],

      after: [
        {
          matcher: (ctx) => ctx.path === "/sign-up/email",
          handler: createAuthMiddleware(async (ctx) => {
            const code = ctx.getHeader(referralCodeKey);
            const referredUser = ctx.context.newSession?.user;

            if (!code || !referredUser) return;

            await createReferral({ ctx, code, options, referredUser });
          }),
        },
        {
          matcher: (ctx) => ctx.path === "/sign-in/social",
          handler: createAuthMiddleware(async (ctx) => {
            const referralData = getOAuthBodyReferralData(ctx, referralCodeKey);
            const referredUser = ctx.context.newSession?.user;

            if (!referralData || !referredUser) return;

            if (
              !wasUserCreatedDuringOAuthFlow(
                referredUser,
                referralData.startedAt,
              )
            ) {
              return;
            }

            await createReferral({
              ctx,
              code: referralData.code,
              options,
              referredUser,
            });
          }),
        },
        {
          matcher: (ctx) =>
            ctx.path === "/callback/:id" ||
            ctx.path === "/oauth2/callback/:providerId",
          handler: createAuthMiddleware(async (ctx) => {
            const referralData =
              await getOAuthStateReferralData(referralCodeKey);
            const referredUser = ctx.context.newSession?.user;

            if (!referralData || !referredUser) return;

            if (
              !wasUserCreatedDuringOAuthFlow(
                referredUser,
                referralData.startedAt,
              )
            ) {
              return;
            }

            await createReferral({
              ctx,
              code: referralData.code,
              options,
              referredUser,
            });
          }),
        },
      ],
    },

    schema: betterAuthReferralSchema,
    endpoints: allRoutes(options),
  } satisfies BetterAuthPlugin;
};
