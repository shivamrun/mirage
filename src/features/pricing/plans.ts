import { Check, Rocket, Sparkles } from "lucide-react";

export type BillingInterval = "monthly" | "annual";
export type PricingPlanKey = "free" | "hacker" | "pro";

export const billingIntervalRank: Record<BillingInterval, number> = {
  monthly: 0,
  annual: 1,
};

export const billingIntervalLabels: Record<BillingInterval, string> = {
  monthly: "Monthly",
  annual: "Annual",
};

export const pricingPlanRank: Record<PricingPlanKey, number> = {
  free: 0,
  pro: 1,
  hacker: 2,
};

export const pricingPlans = [
  {
    key: "free",
    name: "Free",
    eyebrow: "Start",
    description: "Everything needed to explore Mirage and set up your account.",
    price: {
      annual: "$0",
      monthly: "$0",
    },
    priceSuffix: "forever",
    icon: Check,
    features: [
      "Authenticated account workspace",
      "Profile and security settings",
      "Email support for product updates",
    ],
    cta: "Current starter plan",
  },
  {
    key: "pro",
    name: "Pro",
    checkoutPlanName: "Mirage Pro",
    eyebrow: "Upgrade",
    description: "Unlock the paid workspace with Stripe-hosted checkout.",
    price: {
      annual: "$100",
      monthly: "$10",
    },
    priceSuffix: "per user",
    icon: Sparkles,
    features: [
      "Static Pro subscription identity",
      "Stripe-hosted checkout",
      "Monthly or yearly billing",
      "Webhook-backed subscription updates",
    ],
    cta: "Buy Pro",
  },
  {
    key: "hacker",
    name: "Mirage Hacker",
    checkoutPlanName: "Mirage Hacker",
    eyebrow: "Scale",
    description: "Higher limits for serious builders and heavier usage.",
    price: {
      annual: "$300",
      monthly: "$30",
    },
    priceSuffix: "per user",
    icon: Rocket,
    features: [
      "Everything in Pro",
      "Higher monthly credit allowance",
      "Priority billing and account controls",
      "Built for power users and launch weeks",
    ],
    cta: "Buy Hacker",
  },
] as const satisfies Array<{
  checkoutPlanName?: string;
  cta: string;
  description: string;
  eyebrow: string;
  features: readonly string[];
  icon: typeof Check;
  key: PricingPlanKey;
  name: string;
  price: Record<BillingInterval, string>;
  priceSuffix: string;
}>;
