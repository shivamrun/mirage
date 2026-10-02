import { stripeBillingProvider } from "@/adapters/stripe/billing-provider";

function isProviderResourceMissing(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      (("statusCode" in error && error.statusCode === 404) ||
        ("code" in error && error.code === "resource_missing")),
  );
}

export async function deleteBillingCustomer(customerId: string) {
  try {
    await stripeBillingProvider.deleteCustomer(customerId);
  } catch (error) {
    if (!isProviderResourceMissing(error)) throw error;
  }
}

export async function cancelBillingSubscriptions(subscriptionIds: string[]) {
  for (const subscriptionId of new Set(subscriptionIds)) {
    try {
      await stripeBillingProvider.cancelSubscription(subscriptionId);
    } catch (error) {
      if (!isProviderResourceMissing(error)) throw error;
    }
  }
}
