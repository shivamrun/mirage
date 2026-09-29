import type {
  NotificationPayloadMap,
  NotificationRecord,
} from "../domain/types";
import { normalizeNotificationType } from "./registry";

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
  "account.email_changed": (notification) => ({
    description: `Your account email was changed to ${notification.data.email}.`,
    href: "/account/profile",
    title: "Email changed",
  }),
  "account.email_change_requested": (notification) => ({
    description: `Email change to ${notification.data.email} is pending.`,
    href: "/account",
    title: "Email change pending",
  }),
  "account.two_factor_email_code": () => ({
    description: "A two-factor authentication email code was sent.",
    href: "/account/security",
    title: "Two-factor email code",
  }),
  "auth.email_verification": () => ({
    description: "An email verification message was sent.",
    href: "/account",
    title: "Email verification",
  }),
  "auth.password_reset": () => ({
    description: "A password reset email was sent.",
    href: "/sign-in",
    title: "Password reset",
  }),
  "auth.welcome": () => ({
    description: "A welcome email was sent.",
    href: "/account",
    title: "Welcome email",
  }),
  "billing.credit_top_up_completed": (notification) => ({
    description: `${notification.data.amount} credits were added to your account.`,
    href: "/billing",
    title: "Credit top-up complete",
  }),
  "billing.payment_failed": (notification) => ({
    description: notification.data.plan
      ? `Payment failed for ${notification.data.plan}.`
      : "A billing payment could not be completed.",
    href: "/billing",
    title: "Payment failed",
  }),
  "billing.subscription_canceled": (notification) => ({
    description: notification.data.cancelAtPeriodEnd
      ? `${notification.data.plan} is scheduled to end after the current period.`
      : `${notification.data.plan} has been canceled.`,
    href: "/billing",
    title: "Subscription canceled",
  }),
  "billing.subscription_started": (notification) => ({
    description: notification.data.interval
      ? `${notification.data.plan} is now active on ${notification.data.interval} billing.`
      : `${notification.data.plan} is now active.`,
    href: "/billing",
    title: "Subscription started",
  }),
  "billing.subscription_updated": (notification) => ({
    description: [
      `${notification.data.plan} subscription updated.`,
      notification.data.interval
        ? `Billing interval: ${notification.data.interval}.`
        : null,
      notification.data.status ? `Status: ${notification.data.status}.` : null,
    ]
      .filter(Boolean)
      .join(" "),
    href: "/billing",
    title: "Subscription updated",
  }),
  "credits.low_balance": (notification) => ({
    description: `${notification.data.balance} credits remaining. Threshold: ${notification.data.threshold}.`,
    href: "/credits",
    title: "Low credit balance",
  }),
  "email_list.verification": (notification) => ({
    description: `A verification email was sent for ${notification.data.listName}.`,
    title: "Email list verification",
  }),
  "referrals.completed": (notification) => ({
    description: `${notification.data.creditAmount} referral reward credits were added to your account.`,
    href: "/account/referrals",
    title: "Referral complete",
  }),
  "referrals.signup_recorded": (notification) => ({
    description: `${notification.data.referredUserName || notification.data.referredUserEmail} signed up with your referral link.`,
    href: "/account/referrals",
    title: "Referral signup",
  }),
  "security.account_alert": (notification) => ({
    description: notification.data.ipAddress
      ? `${notification.data.action} from ${notification.data.ipAddress}.`
      : notification.data.action,
    href: "/account/security",
    title: "Security alert",
  }),
} satisfies {
  [Type in keyof NotificationPayloadMap]: NotificationPresenter<Type>;
};

export function presentNotification(
  notification: NotificationRecord,
): NotificationPresentation {
  const type = normalizeNotificationType(notification.type);
  const presenter = type ? notificationPresenters[type] : null;

  if (!presenter) {
    return {
      description: "Open your account to review this notification.",
      href: "/account/notifications",
      title: "Notification",
    };
  }

  return presenter({ ...notification, type } as never);
}
