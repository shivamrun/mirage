export const billingCatalog = {
  creditTopUp: {
    amount: 5000,
    credits: 200,
    currency: "usd",
    lookupKey: "one_time_credit",
  },
  subscriptions: {
    hacker: {
      credits: 100,
      displayName: "Mirage Hacker",
      prices: {
        monthly: {
          interval: "month",
          lookupKey: "mirage_hacker_monthly",
        },
        yearly: {
          interval: "year",
          lookupKey: "mirage_hacker_yearly",
        },
      },
    },
    pro: {
      credits: 50,
      displayName: "Mirage Pro",
      prices: {
        monthly: {
          interval: "month",
          lookupKey: "mirage_pro_2_monthly",
        },
        yearly: {
          interval: "year",
          lookupKey: "mirage_pro_2_yearly",
        },
      },
    },
  },
} as const;

export type BillingCheckoutInterval =
  keyof (typeof billingCatalog.subscriptions.pro)["prices"];
export type BillingCheckoutPlan = keyof typeof billingCatalog.subscriptions;

export function getSubscriptionCatalogEntry({
  interval,
  plan,
}: {
  interval: BillingCheckoutInterval;
  plan: BillingCheckoutPlan;
}) {
  return billingCatalog.subscriptions[plan].prices[interval];
}

export function getSubscriptionPlanByLookupKey(lookupKey?: null | string) {
  if (!lookupKey) {
    return null;
  }

  for (const [plan, config] of Object.entries(billingCatalog.subscriptions)) {
    for (const price of Object.values(config.prices)) {
      if (price.lookupKey === lookupKey) {
        return {
          displayName: config.displayName,
          interval: price.interval,
          plan,
        };
      }
    }
  }

  return null;
}
