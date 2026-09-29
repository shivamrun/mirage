import type { BetterAuthReferralOptions } from "../types";
import { listReferralsRoute } from "./list-referrals";
import { markReferralStepCompleteRoute } from "./mark-referral-step-complete";
import { referralDashboardSummaryRoute } from "./referral-dashboard-summary";

export function allRoutes(options: BetterAuthReferralOptions) {
  return {
    getMyReferralDashboard: referralDashboardSummaryRoute(options),
    listReferrals: listReferralsRoute(options),
    markReferralStepComplete: markReferralStepCompleteRoute(options),
  };
}
