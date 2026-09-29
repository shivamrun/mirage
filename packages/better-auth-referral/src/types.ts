import type { User } from "better-auth";

export const betterAuthReferralPluginId = "better-auth-referral";
export const defaultReferralCodeKey = "x-referral-code";
export const signUpReferralStep = "sign_up";

export type ReferralStatus = "pending" | "completed";

export type AfterSuccessfulSignUpCallback = (
  referrerUser: User,
  referredUser: User,
) => Promise<void> | void;

export type ReferralLifecycle = {
  id: string;
  referrerUserId: string;
  referredUserId: string;
  status: ReferralStatus;
  completedAt: Date | null;
};

export type ReferralProgress = {
  requiredSteps: string[];
  completedSteps: string[];
  remainingSteps: string[];
  completed: number;
  total: number;
  isCompleted: boolean;
};

export type ReferralStepCompletedPayload = {
  referrerUser: User;
  referredUser: User;
  referral: ReferralLifecycle;
  step: string;
  progress: ReferralProgress;
  metadata?: Record<string, unknown> | undefined;
};

export type ReferralCompletedPayload = {
  referrerUser: User;
  referredUser: User;
  referral: ReferralLifecycle;
  progress: ReferralProgress;
};

export type AfterReferralStepCompletedCallback = (
  payload: ReferralStepCompletedPayload,
) => Promise<void> | void;

export type AfterReferralCompletedCallback = (
  payload: ReferralCompletedPayload,
) => Promise<void> | void;

export type BetterAuthReferralOptions = {
  maskReferredUserEmail?: boolean;
  referralCodeKey?: string;
  steps?: string[];
  afterSuccessfulSignUp?: AfterSuccessfulSignUpCallback;
  afterReferralStepCompleted?: AfterReferralStepCompletedCallback;
  afterReferralCompleted?: AfterReferralCompletedCallback;
};
export type ReferralCodeReferrer = {
  id: string;
  userId: string;
};

export type ReferralCodeDashboard = {
  code: string;
};

export type ReferralRecord = {
  id: string;
  referredUserId: string;
  status?: ReferralStatus | null;
  completedAt?: Date | null;
  createdAt: Date;
};

export type ReferralStepCompletionRecord = {
  referralId: string;
  step: string;
  completedAt: Date;
};

export type ReferralUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};
