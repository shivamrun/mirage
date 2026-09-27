const BILLING_CHECKOUT_SNAPSHOT_KEY = "mirage:billing-checkout-snapshot";

export function markBillingCheckoutStarted(snapshotKey?: string) {
  if (!snapshotKey || typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(BILLING_CHECKOUT_SNAPSHOT_KEY, snapshotKey);
}

export function readStartedBillingCheckoutSnapshot() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage.getItem(BILLING_CHECKOUT_SNAPSHOT_KEY);
}

export function clearStartedBillingCheckoutSnapshot() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(BILLING_CHECKOUT_SNAPSHOT_KEY);
}
