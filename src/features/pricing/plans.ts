import { Check, Rocket, Sparkles } from "lucide-react";
import {
  type BillingInterval,
  type BillingPlanKey,
  billingCatalog,
} from "@/shared/billing";

export type { BillingInterval } from "@/shared/billing";
export type PricingPlanKey = BillingPlanKey;

export const billingIntervalRank: Record<BillingInterval, number> = {
  monthly: 0,
  annual: 1,
};

export const billingIntervalLabels: Record<BillingInterval, string> = {
  monthly: "Monthly",
  annual: "Annual",
};

export const pricingPlanRank: Record<PricingPlanKey, number> = {
  free: billingCatalog.plans.free.rank,
  pro: billingCatalog.plans.pro.rank,
  hacker: billingCatalog.plans.hacker.rank,
};

export const pricingPlans = [
  {
    key: "free",
    name: billingCatalog.plans.free.displayName,
    eyebrow: "Start",
    description: "Everything needed to explore Mirage and set up your account.",
    credits: billingCatalog.plans.free.credits,
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
    name: billingCatalog.plans.pro.displayName,
    checkoutPlanName: billingCatalog.plans.pro.checkoutName,
    eyebrow: "Upgrade",
    description: "Unlock the paid workspace with Stripe-hosted checkout.",
    credits: billingCatalog.plans.pro.credits,
    price: {
      annual: billingCatalog.plans.pro.prices.annual.displayPrice,
      monthly: billingCatalog.plans.pro.prices.monthly.displayPrice,
    },
    priceSuffix: "per user",
    icon: Sparkles,
    cta: "Buy Pro",
  },
  {
    key: "hacker",
    name: billingCatalog.plans.hacker.displayName,
    checkoutPlanName: billingCatalog.plans.hacker.checkoutName,
    eyebrow: "Scale",
    description: "More credits for serious builders and heavier usage.",
    credits: billingCatalog.plans.hacker.credits,
    price: {
      annual: billingCatalog.plans.hacker.prices.annual.displayPrice,
      monthly: billingCatalog.plans.hacker.prices.monthly.displayPrice,
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
