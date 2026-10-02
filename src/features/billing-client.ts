import { authClient } from "@/features/auth/better-auth/client";
import { api } from "@/shared/api/client";
import type { BillingCheckoutInput } from "@/shared/schemas/credits";

export const billingClient = {
  cancelSubscription: authClient.subscription.cancel,
  changeSubscription: authClient.subscription.upgrade,
  openPortal: authClient.subscription.billingPortal,
  restoreSubscription: authClient.subscription.restore,
  startCreditTopUp(input: BillingCheckoutInput) {
    return api.api.billing.checkout.post(input, {
      headers: { "content-type": "application/json" },
    });
  },
};
