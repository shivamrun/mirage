import type { NotificationChannel } from "../domain/types";
import { notificationPayloadSchemas } from "./payloads";

type NotificationDefinition = {
  category: "account" | "billing" | "product" | "security" | "system";
  channels: readonly NotificationChannel[];
  payloadSchema: (typeof notificationPayloadSchemas)[keyof typeof notificationPayloadSchemas];
};

export const notificationRegistry = {
  ACCOUNT_EMAIL_CHANGED: {
    category: "account",
    channels: ["in_app"],
    payloadSchema: notificationPayloadSchemas.ACCOUNT_EMAIL_CHANGED,
  },
  ACCOUNT_SECURITY_ALERT: {
    category: "security",
    channels: ["in_app"],
    payloadSchema: notificationPayloadSchemas.ACCOUNT_SECURITY_ALERT,
  },
  BILLING_PAYMENT_FAILED: {
    category: "billing",
    channels: ["in_app"],
    payloadSchema: notificationPayloadSchemas.BILLING_PAYMENT_FAILED,
  },
  CREDITS_LOW_BALANCE: {
    category: "product",
    channels: ["in_app"],
    payloadSchema: notificationPayloadSchemas.CREDITS_LOW_BALANCE,
  },
  SYSTEM_ANNOUNCEMENT: {
    category: "system",
    channels: ["in_app"],
    payloadSchema: notificationPayloadSchemas.SYSTEM_ANNOUNCEMENT,
  },
} as const satisfies Record<string, NotificationDefinition>;

export function getNotificationDefinition(
  type: keyof typeof notificationRegistry,
) {
  return notificationRegistry[type];
}
