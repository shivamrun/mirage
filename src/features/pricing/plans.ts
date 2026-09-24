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
    credits: 10,
    price: {
      annual: "$0",
      monthly: "$0",
    },
    priceSuffix: "forever",
    icon: Check,
    cta: "Current starter plan",
  },
  {
    key: "pro",
    name: "Pro",
    checkoutPlanName: "Mirage Pro",
    eyebrow: "Upgrade",
    description: "Unlock the paid workspace with Stripe-hosted checkout.",
    credits: 50,
    price: {
      annual: "$100",
      monthly: "$10",
    },
    priceSuffix: "per user",
    icon: Sparkles,
    cta: "Buy Pro",
  },
  {
    key: "hacker",
    name: "Mirage Hacker",
    checkoutPlanName: "Mirage Hacker",
    eyebrow: "Scale",
    description: "More credits for serious builders and heavier usage.",
    credits: 100,
    price: {
      annual: "$300",
      monthly: "$30",
    },
    priceSuffix: "per user",
    icon: Rocket,
    cta: "Buy Hacker",
  },
] as const satisfies Array<{
  checkoutPlanName?: string;
  credits: number;
  cta: string;
  description: string;
  eyebrow: string;
  icon: typeof Check;
  key: PricingPlanKey;
  name: string;
  price: Record<BillingInterval, string>;
  priceSuffix: string;
}>;
