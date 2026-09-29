import type { NotificationChannel } from "../domain/types";
import { notificationPayloadSchemas } from "./payloads";

type NotificationDefinition = {
  category: "account" | "billing" | "product" | "security" | "system";
  channels: readonly NotificationChannel[];
  payloadSchema: (typeof notificationPayloadSchemas)[keyof typeof notificationPayloadSchemas];
};

export const notificationRegistry = {
  "account.email_changed": {
    category: "account",
    channels: ["in_app"],
    payloadSchema: notificationPayloadSchemas["account.email_changed"],
  },
  "account.email_change_requested": {
    category: "account",
    channels: ["in_app"],
    payloadSchema: notificationPayloadSchemas["account.email_change_requested"],
  },
  "account.two_factor_email_code": {
    category: "security",
    channels: ["email"],
    payloadSchema: notificationPayloadSchemas["account.two_factor_email_code"],
  },
  "auth.email_verification": {
    category: "security",
    channels: ["email"],
    payloadSchema: notificationPayloadSchemas["auth.email_verification"],
  },
  "auth.password_reset": {
    category: "security",
    channels: ["email"],
    payloadSchema: notificationPayloadSchemas["auth.password_reset"],
  },
  "auth.welcome": {
    category: "account",
    channels: ["email"],
    payloadSchema: notificationPayloadSchemas["auth.welcome"],
  },
  "billing.credit_top_up_completed": {
    category: "billing",
    channels: ["in_app"],
    payloadSchema:
      notificationPayloadSchemas["billing.credit_top_up_completed"],
  },
  "billing.payment_failed": {
    category: "billing",
    channels: ["in_app"],
    payloadSchema: notificationPayloadSchemas["billing.payment_failed"],
  },
  "billing.subscription_canceled": {
    category: "billing",
    channels: ["in_app"],
    payloadSchema: notificationPayloadSchemas["billing.subscription_canceled"],
  },
  "billing.subscription_started": {
    category: "billing",
    channels: ["in_app"],
    payloadSchema: notificationPayloadSchemas["billing.subscription_started"],
  },
  "billing.subscription_updated": {
    category: "billing",
    channels: ["in_app"],
    payloadSchema: notificationPayloadSchemas["billing.subscription_updated"],
  },
  "credits.low_balance": {
    category: "product",
    channels: ["in_app"],
    payloadSchema: notificationPayloadSchemas["credits.low_balance"],
  },
  "email_list.verification": {
    category: "product",
    channels: ["email"],
    payloadSchema: notificationPayloadSchemas["email_list.verification"],
  },
  "referrals.completed": {
    category: "product",
    channels: ["email"],
    payloadSchema: notificationPayloadSchemas["referrals.completed"],
  },
  "referrals.signup_recorded": {
    category: "product",
    channels: ["in_app"],
    payloadSchema: notificationPayloadSchemas["referrals.signup_recorded"],
  },
  "security.account_alert": {
    category: "security",
    channels: ["in_app"],
    payloadSchema: notificationPayloadSchemas["security.account_alert"],
  },
} as const satisfies Record<string, NotificationDefinition>;

const legacyNotificationTypeMap = {
  ACCOUNT_EMAIL_CHANGED: "account.email_changed",
  ACCOUNT_EMAIL_CHANGE_REQUESTED: "account.email_change_requested",
  ACCOUNT_SECURITY_ALERT: "security.account_alert",
  BILLING_CREDIT_TOP_UP_COMPLETED: "billing.credit_top_up_completed",
  BILLING_PAYMENT_FAILED: "billing.payment_failed",
  BILLING_SUBSCRIPTION_CANCELED: "billing.subscription_canceled",
  BILLING_SUBSCRIPTION_STARTED: "billing.subscription_started",
  BILLING_SUBSCRIPTION_UPDATED: "billing.subscription_updated",
  CREDITS_LOW_BALANCE: "credits.low_balance",
  REFERRALS_COMPLETED: "referrals.completed",
  REFERRALS_SIGNUP_RECORDED: "referrals.signup_recorded",
} as const satisfies Record<string, keyof typeof notificationRegistry>;

export function normalizeNotificationType(type: string) {
  if (type in notificationRegistry) {
    return type as keyof typeof notificationRegistry;
  }

  return legacyNotificationTypeMap[
    type as keyof typeof legacyNotificationTypeMap
  ];
}

export function getNotificationDefinition(
  type: keyof typeof notificationRegistry,
) {
  return notificationRegistry[type];
}
