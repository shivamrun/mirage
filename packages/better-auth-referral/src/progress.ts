import type { User, Where } from "better-auth";
import { isUniqueConstraintError } from "./helpers";
import {
  type BetterAuthReferralOptions,
  type ReferralLifecycle,
  type ReferralProgress,
  type ReferralStatus,
  type ReferralStepCompletionRecord,
  signUpReferralStep,
} from "./types";

type ReferralProgressAdapter = {
  create: (params: {
    data: Record<string, unknown>;
    model: string;
    select?: string[];
  }) => Promise<unknown>;
  findMany: (params: {
    model: string;
    select?: string[];
    where?: Where[];
  }) => Promise<unknown>;
  findOne: (params: {
    model: string;
    select?: string[];
    where: Where[];
  }) => Promise<unknown>;
  update: (params: {
    model: string;
    update: Record<string, unknown>;
    where: Where[];
  }) => Promise<unknown>;
};

type CompleteReferralStepInput = {
  adapter: ReferralProgressAdapter;
  options: BetterAuthReferralOptions;
  referral: ReferralLifecycle;
  step: string;
  metadata?: Record<string, unknown> | undefined;
  referrerUser?: User | undefined;
  referredUser?: User | undefined;
};

export type CompleteReferralStepResult = {
  alreadyCompleted: boolean;
  referral: ReferralLifecycle;
  progress: ReferralProgress;
  step: {
    step: string;
    completedAt: Date | null;
  };
};

function getCompletionKey(referralId: string, step: string) {
  return `${referralId}:${step}`;
}

function unique(values: string[]) {
  return [...new Set(values)];
}

export function validateReferralSteps(options: BetterAuthReferralOptions) {
  const configuredSteps = options.steps ?? [];
  const seenSteps = new Set<string>();

  for (const step of configuredSteps) {
    if (step.trim() !== step || step.length === 0) {
      throw new Error("Referral steps must be non-empty trimmed strings.");
    }

    if (step === signUpReferralStep) {
      throw new Error(
        `"${signUpReferralStep}" is reserved and is completed automatically.`,
      );
    }

    if (seenSteps.has(step)) {
      throw new Error(`Duplicate referral step "${step}" is not allowed.`);
    }

    seenSteps.add(step);
  }
}

export function getRequiredReferralSteps(options: BetterAuthReferralOptions) {
  return unique([signUpReferralStep, ...(options.steps ?? [])]);
}

export function normalizeReferralStatus(
  status: ReferralStatus | null | undefined,
): ReferralStatus {
  return status ?? "completed";
}

export function getReferralProgress({
  completedSteps,
  options,
  referral,
}: {
  completedSteps: string[];
  options: BetterAuthReferralOptions;
  referral?: { status?: ReferralStatus | null };
}): ReferralProgress {
  const requiredSteps = getRequiredReferralSteps(options);
  const completedStepSet = new Set(completedSteps);
  const isLegacyCompletedReferral =
    referral?.status === undefined ||
    referral?.status === null ||
    referral.status === "completed";

  if (isLegacyCompletedReferral) {
    for (const step of requiredSteps) {
      completedStepSet.add(step);
    }
  }

  const requiredCompletedSteps = requiredSteps.filter((step) =>
    completedStepSet.has(step),
  );
  const remainingSteps = requiredSteps.filter(
    (step) => !completedStepSet.has(step),
  );

  return {
    requiredSteps,
    completedSteps: requiredCompletedSteps,
    remainingSteps,
    completed: requiredCompletedSteps.length,
    total: requiredSteps.length,
    isCompleted: remainingSteps.length === 0,
  };
}

export function toReferralLifecycle(
  referral: ReferralLifecycle,
): ReferralLifecycle {
  return {
    ...referral,
    status: normalizeReferralStatus(referral.status),
    completedAt: referral.completedAt ?? null,
  };
}

async function getReferralStepCompletions(
  adapter: ReferralProgressAdapter,
  referralId: string,
) {
  return (await adapter.findMany({
    model: "referralStepCompletion",
    where: [{ field: "referralId", value: referralId }],
    select: ["referralId", "step", "completedAt"],
  })) as ReferralStepCompletionRecord[];
}

async function runIgnored(callback: (() => Promise<void> | void) | undefined) {
  try {
    await callback?.();
  } catch {
    // Referral progress callbacks should not fail the triggering auth flow.
  }
}

export async function completeReferralStep({
  adapter,
  metadata,
  options,
  referral,
  referredUser,
  referrerUser,
  step,
}: CompleteReferralStepInput): Promise<CompleteReferralStepResult> {
  const completionKey = getCompletionKey(referral.id, step);
  const existingCompletion = (await adapter.findOne({
    model: "referralStepCompletion",
    where: [{ field: "completionKey", value: completionKey }],
    select: ["step", "completedAt"],
  })) as Pick<ReferralStepCompletionRecord, "step" | "completedAt"> | null;

  let completedAt = existingCompletion?.completedAt ?? null;
  let alreadyCompleted = Boolean(existingCompletion);

  if (!existingCompletion) {
    try {
      const createdCompletion = (await adapter.create({
        model: "referralStepCompletion",
        data: {
          referralId: referral.id,
          step,
          completionKey,
          metadata,
        },
        select: ["step", "completedAt"],
      })) as Pick<ReferralStepCompletionRecord, "step" | "completedAt">;

      completedAt = createdCompletion.completedAt;
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      alreadyCompleted = true;
    }
  }

  const completions = await getReferralStepCompletions(adapter, referral.id);
  const completedSteps = completions.map((completion) => completion.step);

  if (!alreadyCompleted && !completedSteps.includes(step)) {
    completedSteps.push(step);
  }

  const progress = getReferralProgress({
    completedSteps,
    options,
    referral,
  });
  let lifecycleReferral = toReferralLifecycle(referral);

  if (!alreadyCompleted && referrerUser && referredUser) {
    await runIgnored(() =>
      options.afterReferralStepCompleted?.({
        referrerUser,
        referredUser,
        referral: lifecycleReferral,
        step,
        progress,
        metadata,
      }),
    );
  }

  if (
    progress.isCompleted &&
    normalizeReferralStatus(referral.status) !== "completed"
  ) {
    const completedReferral = (await adapter.update({
      model: "referrals",
      where: [
        { field: "id", value: referral.id },
        { field: "status", value: "pending" },
      ],
      update: {
        status: "completed",
        completedAt: new Date(),
      },
    })) as ReferralLifecycle | null;

    if (completedReferral) {
      lifecycleReferral = toReferralLifecycle(completedReferral);

      if (referrerUser && referredUser) {
        await runIgnored(() =>
          options.afterReferralCompleted?.({
            referrerUser,
            referredUser,
            referral: lifecycleReferral,
            progress,
          }),
        );
      }
    }
  }

  return {
    alreadyCompleted,
    referral: lifecycleReferral,
    progress,
    step: {
      step,
      completedAt,
    },
  };
}
