import type {
  NotificationPayloadMap,
  NotificationRecord,
} from "../domain/types";

type NotificationPresentation = {
  description: string;
  href?: string;
  title: string;
};

type NotificationPresenter<Type extends keyof NotificationPayloadMap> = (
  notification: NotificationRecord & {
    data: NotificationPayloadMap[Type];
    type: Type;
  },
) => NotificationPresentation;

const notificationPresenters = {
  ACCOUNT_EMAIL_CHANGED: (notification) => ({
    description: `Your account email was changed to ${notification.data.email}.`,
    href: "/account/profile",
    title: "Email changed",
  }),
  ACCOUNT_SECURITY_ALERT: (notification) => ({
    description: notification.data.ipAddress
      ? `${notification.data.action} from ${notification.data.ipAddress}.`
      : notification.data.action,
    href: "/account/security",
    title: "Security alert",
  }),
  BILLING_PAYMENT_FAILED: (notification) => ({
    description: notification.data.plan
      ? `Payment failed for ${notification.data.plan}.`
      : "A billing payment could not be completed.",
    href: "/billing",
    title: "Payment failed",
  }),
  CREDITS_LOW_BALANCE: (notification) => ({
    description: `${notification.data.balance} credits remaining. Threshold: ${notification.data.threshold}.`,
    href: "/credits",
    title: "Low credit balance",
  }),
  SYSTEM_ANNOUNCEMENT: (notification) => ({
    description: notification.data.message,
    href: notification.data.url,
    title: notification.data.title,
  }),
} satisfies {
  [Type in keyof NotificationPayloadMap]: NotificationPresenter<Type>;
};

export function presentNotification(notification: NotificationRecord) {
  const presenter = notificationPresenters[notification.type];

  return presenter(notification as never);
}
