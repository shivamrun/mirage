import type { BillingInterval, PricingPlanKey } from "@/features/pricing/plans";
import type {
  BillingCheckoutInterval,
  BillingCheckoutPlan,
} from "@/server/db/services/billing/catalog";
import type { CreditSampleItemKey } from "@/shared/credits/sample-catalog";

const distinctIdMaxLength = 50;
const analyticsAttributionValueMaxLength = 120;

export type AnalyticsCurrency = "USD";

export type AnalyticsAttribution = {
  creator?: string;
  landingPath?: string;
  referrerDomain?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmMedium?: string;
  utmSource?: string;
  utmTerm?: string;
};

export type AnalyticsAttributionProperties = {
  attribution?: AnalyticsAttribution;
};

export type AnalyticsRevenue =
  | {
      currency: AnalyticsCurrency;
      revenue: number;
    }
  | {
      currency?: never;
      revenue?: never;
    };

export type ClientAnalyticsEventMap = {
  login_completed: undefined;
  subscription_checkout_started: {
    billingInterval: BillingInterval;
    plan: Exclude<PricingPlanKey, "free">;
    scheduleAtPeriodEnd: boolean;
  } & AnalyticsAttributionProperties;
};

export type ServerBestEffortEventMap = {
  contact_submitted: {
    hasCompany: boolean;
  } & AnalyticsAttributionProperties;
  credit_top_up_checkout_started: {
    amountCents: number;
    credits: number;
    currency: AnalyticsCurrency;
  } & AnalyticsAttributionProperties;
  credits_consumed: {
    credits: number;
    itemKey: CreditSampleItemKey;
    source: "sample_credit_lab";
  };
  credits_exhausted: {
    availableCredits: number;
    itemKey: CreditSampleItemKey;
    requestedCredits: number;
    source: "sample_credit_lab";
  };
  email_list_signup_completed: {
    listKey: string;
    source: null | string;
    verificationRequired: boolean;
  } & AnalyticsAttributionProperties;
  signup_completed: undefined;
};

export type ServerAuthoritativeEventMap = {
  credits_purchased: {
    credits: number;
    currency: AnalyticsCurrency;
    revenue: number;
  } & AnalyticsAttributionProperties;
  subscription_cancelled: {
    billingInterval: BillingCheckoutInterval;
    cancelAtPeriodEnd: boolean;
    plan: BillingCheckoutPlan;
  };
  subscription_changed: {
    billingInterval: BillingCheckoutInterval;
    plan: BillingCheckoutPlan;
    previousBillingInterval?: BillingCheckoutInterval;
    previousPlan?: BillingCheckoutPlan;
  };
  subscription_ended: {
    billingInterval: BillingCheckoutInterval;
    plan: BillingCheckoutPlan;
  };
  subscription_started: {
    billingInterval: BillingCheckoutInterval;
    plan: BillingCheckoutPlan;
  } & AnalyticsRevenue;
};

export type ExactProperties<Expected, Actual extends Expected> = Actual &
  Record<Exclude<keyof Actual, keyof Expected>, never>;

export type EventsWithoutProperties<EventMap> = {
  [Event in keyof EventMap]: EventMap[Event] extends undefined ? Event : never;
}[keyof EventMap];

export type EventsWithProperties<EventMap> = {
  [Event in keyof EventMap]: EventMap[Event] extends undefined ? never : Event;
}[keyof EventMap];

export type AnalyticsTrack<EventMap, Return, Options = never> = {
  <Event extends EventsWithoutProperties<EventMap>>(
    event: Event,
    options?: Options,
  ): Return;
  <
    Event extends EventsWithProperties<EventMap>,
    Properties extends EventMap[Event],
  >(
    event: Event,
    properties: ExactProperties<EventMap[Event], Properties>,
    options?: Options,
  ): Return;
};

export function isValidDistinctId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= distinctIdMaxLength
  );
}

export function normalizeAnalyticsCurrency(value: string): AnalyticsCurrency {
  const normalizedValue = value.toUpperCase();

  if (normalizedValue !== "USD") {
    throw new Error(`Unsupported analytics currency: ${value}`);
  }

  return normalizedValue;
}

function compactAttributionValue(value: string | null | undefined) {
  const normalizedValue = value?.trim();

  return normalizedValue
    ? normalizedValue.slice(0, analyticsAttributionValueMaxLength)
    : undefined;
}

export function compactAnalyticsAttribution(
  attribution: AnalyticsAttribution | null | undefined,
) {
  if (!attribution) {
    return undefined;
  }

  const compacted = Object.fromEntries(
    Object.entries(attribution)
      .map(([key, value]) => [key, compactAttributionValue(value)])
      .filter(([, value]) => Boolean(value)),
  ) as AnalyticsAttribution;

  return Object.keys(compacted).length > 0 ? compacted : undefined;
}

export function analyticsAttributionFromMetadata(
  metadata: Record<string, null | string | undefined> | null | undefined,
) {
  if (!metadata) {
    return undefined;
  }

  return compactAnalyticsAttribution({
    creator: metadata.analytics_creator ?? undefined,
    landingPath: metadata.analytics_landing_path ?? undefined,
    referrerDomain: metadata.analytics_referrer_domain ?? undefined,
    utmCampaign: metadata.analytics_utm_campaign ?? undefined,
    utmContent: metadata.analytics_utm_content ?? undefined,
    utmMedium: metadata.analytics_utm_medium ?? undefined,
    utmSource: metadata.analytics_utm_source ?? undefined,
    utmTerm: metadata.analytics_utm_term ?? undefined,
  });
}
