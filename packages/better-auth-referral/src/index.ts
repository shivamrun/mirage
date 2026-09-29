export { betterAuthReferralClient } from "./client";
export { betterAuthReferral, defaultReferralCodeKey } from "./server";

export type {
  AfterReferralCompletedCallback,
  AfterReferralStepCompletedCallback,
  AfterSuccessfulSignUpCallback,
  BetterAuthReferralOptions,
  ReferralCodeDashboard,
  ReferralCompletedPayload,
  ReferralLifecycle,
  ReferralProgress,
  ReferralRecord,
  ReferralStatus,
  ReferralStepCompletedPayload,
  ReferralStepCompletionRecord,
  ReferralUser,
} from "./types";
export { signUpReferralStep } from "./types";
