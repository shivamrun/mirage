import { env } from "@/lib/env";
import {
  confirmEmailListVerificationTransaction,
  createEmailListVerification,
  deleteEmailListVerification,
  deleteExpiredEmailListVerifications,
  subscribeEmailToList,
} from "@/server/db/dal/email-list";
import { sendEmailListVerificationEmail } from "@/server/email";
import {
  createEmailListVerificationToken,
  EMAIL_LIST_VERIFICATION_EXPIRES_IN_MS,
  isValidEmailListVerificationToken,
  parseEmailListVerificationPayload,
} from "@/server/email-list/verification";
import { consumePublicWriteLimit } from "@/server/rate-limit";
import type { EmailSubscriptionValues } from "@/zod";

type SubscribeToEmailListResult =
  | {
      status: "success";
      verificationRequired: boolean;
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
    return {
      status: "success",
      verificationRequired,
    };
  }

  const verification = createEmailListVerificationPayload({
    email: subscription.contact.email,
    listKey: subscription.subscription.listKey,
    subscriptionId: subscription.subscription.id,
  });
  const createdVerification = await createEmailListVerification({
    expiresAt: new Date(Date.now() + EMAIL_LIST_VERIFICATION_EXPIRES_IN_MS),
    payload: verification.payload,
    token: verification.token,
  });

  try {
    await sendEmailListVerificationEmail({
      email: subscription.contact.email,
      listKey: subscription.subscription.listKey,
      listName: subscription.list.name,
      verificationUrl: createEmailListVerificationUrl(
        createdVerification.token,
      ),
    });
  } catch {
    await deleteEmailListVerification(createdVerification.token);
    return { status: "delivery-failed" };
  }

  return {
    status: "success",
    verificationRequired,
  };
}

export async function confirmEmailListVerification(
  token: string,
): Promise<ConfirmEmailListVerificationResult> {
  if (!isValidEmailListVerificationToken(token)) {
    return { status: "invalid" };
  }

  await deleteExpiredEmailListVerifications();

  const result = await confirmEmailListVerificationTransaction({
    confirmPayload(value) {
      const payload = parseEmailListVerificationPayload(value);

      return payload?.token === token ? payload : null;
    },
    token,
  });

  if (result.status === "invalid") {
    return { status: "invalid" };
  }

  return {
    email: result.payload.email,
    listKey: result.payload.listKey,
    status: "success",
  };
}
