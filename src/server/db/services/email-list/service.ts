import { compactAnalyticsAttribution } from "@/adapters/analytics/events";
import { analytics } from "@/adapters/analytics/server";
import { consumePublicWriteLimit } from "@/adapters/rate-limit";
import {
  confirmEmailListVerificationTransaction,
  createEmailListVerification,
  deleteEmailListVerification,
  deleteExpiredEmailListVerifications,
  subscribeEmailToList,
} from "@/server/db/dal/email-list";
import {
  createEmailListVerificationToken,
  EMAIL_LIST_VERIFICATION_EXPIRES_IN_MS,
  EMAIL_LIST_VERIFICATION_PREFIX,
  getEmailListVerificationIdentifier,
  isValidEmailListVerificationToken,
  parseEmailListVerificationPayload,
} from "@/server/db/services/email-list/verification";
import { notify } from "@/server/db/services/notifications/service";
import { env } from "@/shared/env";
import type { EmailSubscriptionValues } from "@/shared/schemas";
import { emailSubscriptionSchema } from "@/shared/schemas";

type SubscribeToEmailListResult =
  | {
      status: "subscribed";
    }
  | {
      status: "pending-verification";
    }
  | {
      status: "ignored";
    }
  | {
      retryAfterSeconds: number;
      status: "rate-limited";
    }
  | {
      status: "unknown-list";
    }
  | {
      status: "delivery-failed";
    };

type ConfirmEmailListVerificationResult =
  | {
      email: string;
      listKey: string;
      status: "success";
    }
  | {
      status: "invalid";
    };

function referrerDomain(value: null | string | undefined) {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function attributionFromEmailListMetadata(
  metadata: EmailSubscriptionValues["metadata"],
) {
  return compactAnalyticsAttribution({
    creator: metadata?.creator,
    landingPath: metadata?.landing_path,
    referrerDomain: referrerDomain(metadata?.referrer),
    utmCampaign: metadata?.utm_campaign,
    utmContent: metadata?.utm_content,
    utmMedium: metadata?.utm_medium,
    utmSource: metadata?.utm_source,
    utmTerm: metadata?.utm_term,
  });
}

function trackEmailListSignup(
  subscription: { listKey: string; metadata: unknown; source: string | null },
  verificationRequired: boolean,
) {
  const metadata = emailSubscriptionSchema.shape.metadata.safeParse(
    subscription.metadata,
  );
  void analytics.track("email_list_signup_completed", {
    attribution: attributionFromEmailListMetadata(
      metadata.success ? metadata.data : null,
    ),
    listKey: subscription.listKey,
    source: subscription.source,
    verificationRequired,
  });
}

function createEmailListVerificationUrl(token: string) {
  const url = new URL("/api/email-list/verify", env.NEXT_PUBLIC_BASE_URL);
  url.searchParams.set("token", token);

  return url.toString();
}

function createEmailListVerificationPayload({
  email,
  listKey,
  subscriptionId,
}: {
  email: string;
  listKey: string;
  subscriptionId: string;
}) {
  const token = createEmailListVerificationToken();

  return {
    payload: {
      email,
      listKey,
      subscriptionId,
      token,
    },
    token,
  };
}

export async function subscribeToEmailList(
  values: EmailSubscriptionValues,
): Promise<SubscribeToEmailListResult> {
  if (values.website) {
    return { status: "ignored" };
  }

  const rateLimit = await consumePublicWriteLimit({
    destination: values.email,
    flow: "email-list",
  });
  if (!rateLimit.allowed) {
    return {
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      status: "rate-limited",
    };
  }

  const subscription = await subscribeEmailToList(values);
  if (subscription.status === "unknown-list") {
    return { status: "unknown-list" };
  }

  const verificationRequired = subscription.subscription.status === "pending";

  if (!verificationRequired) {
    if (subscription.activated) {
      trackEmailListSignup(values, false);
    }
    return {
      status: "subscribed",
    };
  }

  const verification = createEmailListVerificationPayload({
    email: subscription.contact.email,
    listKey: subscription.subscription.listKey,
    subscriptionId: subscription.subscription.id,
  });
  const createdVerification = await createEmailListVerification({
    expiresAt: new Date(Date.now() + EMAIL_LIST_VERIFICATION_EXPIRES_IN_MS),
    identifier: getEmailListVerificationIdentifier(verification.token),
    payload: verification.payload,
    token: verification.token,
  });

  try {
    await notify({
      data: {
        email: subscription.contact.email,
        listKey: subscription.subscription.listKey,
        listName: subscription.list.name,
        verificationUrl: createEmailListVerificationUrl(
          createdVerification.token,
        ),
      },
      type: "email_list.verification",
    });
  } catch {
    await deleteEmailListVerification(
      getEmailListVerificationIdentifier(createdVerification.token),
    );
    return { status: "delivery-failed" };
  }

  return {
    status: "pending-verification",
  };
}

export async function confirmEmailListVerification(
  token: string,
): Promise<ConfirmEmailListVerificationResult> {
  if (!isValidEmailListVerificationToken(token)) {
    return { status: "invalid" };
  }

  await deleteExpiredEmailListVerifications(EMAIL_LIST_VERIFICATION_PREFIX);

  const result = await confirmEmailListVerificationTransaction({
    confirmPayload(value) {
      const payload = parseEmailListVerificationPayload(value);

      return payload?.token === token ? payload : null;
    },
    identifier: getEmailListVerificationIdentifier(token),
  });

  if (result.status === "invalid") {
    return { status: "invalid" };
  }

  trackEmailListSignup(result.subscription, true);

  return {
    email: result.payload.email,
    listKey: result.payload.listKey,
    status: "success",
  };
}
