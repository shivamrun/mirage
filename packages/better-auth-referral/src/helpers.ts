import { APIError } from "better-auth/api";
import { customAlphabet } from "nanoid";
import { z } from "zod";
import {
  type BetterAuthReferralOptions,
  defaultReferralCodeKey,
  type ReferralCodeDashboard,
} from "./types";

type ReferralCodeAdapter = {
  create: (params: {
    data: Record<string, unknown>;
    model: string;
    select?: string[];
  }) => Promise<unknown>;
  findOne: (params: {
    model: string;
    select?: string[];
    where: Array<{
      field: string;
      value: string;
    }>;
  }) => Promise<unknown>;
};

export function isUniqueConstraintError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  if ("code" in error && error.code === "23505") {
    return true;
  }

  if ("cause" in error && isUniqueConstraintError(error.cause)) {
    return true;
  }

  if ("message" in error && typeof error.message === "string") {
    return error.message.toLowerCase().includes("unique");
  }

  return false;
}

export const generateReferralCode = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  8,
);

export const referralCodeSchema = z
  .string()
  .regex(
    /^[A-Z0-9]{8}$/,
    "Code must be exactly 8 uppercase alphanumeric characters.",
  );

export function getReferralCodeKey(options: BetterAuthReferralOptions) {
  return options.referralCodeKey ?? defaultReferralCodeKey;
}

export function maskEmail(email: string) {
  const [localPart, domain] = email.split("@");

  if (!localPart || !domain) {
    return "hidden";
  }

  return `${localPart[0]}***@${domain}`;
}

async function createReferralCode(
  adapter: ReferralCodeAdapter,
  userId: string,
) {
  const MAX_RETRIES = 10;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const code = generateReferralCode();

    try {
      return (await adapter.create({
        model: "referralCode",
        data: {
          userId,
          code,
        },
        select: ["code"],
      })) as ReferralCodeDashboard;
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const referralCode = (await adapter.findOne({
        model: "referralCode",
        where: [
          {
            field: "userId",
            value: userId,
          },
        ],
        select: ["code"],
      })) as ReferralCodeDashboard | null;

      if (referralCode) {
        return referralCode;
      }
    }
  }

  return null;
}

export async function getOrCreateReferralCode(
  adapter: ReferralCodeAdapter,
  userId: string,
) {
  const referralCode = (await adapter.findOne({
    model: "referralCode",
    where: [
      {
        field: "userId",
        value: userId,
      },
    ],
    select: ["code"],
  })) as ReferralCodeDashboard | null;

  if (referralCode) {
    return referralCode;
  }

  const createdReferralCode = await createReferralCode(adapter, userId);

  if (createdReferralCode) {
    return createdReferralCode;
  }

  throw new APIError("INTERNAL_SERVER_ERROR", {
    message: "Could not generate a referral code.",
  });
}

export async function tryCreateReferralCode(
  adapter: ReferralCodeAdapter,
  userId: string,
) {
  try {
    const referralCode = (await adapter.findOne({
      model: "referralCode",
      where: [
        {
          field: "userId",
          value: userId,
        },
      ],
      select: ["code"],
    })) as ReferralCodeDashboard | null;

    if (referralCode) {
      return referralCode;
    }

    return await createReferralCode(adapter, userId);
  } catch {
    return null;
  }
}
