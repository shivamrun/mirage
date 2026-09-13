import { env } from "@/lib/env";
import {
  createEmailListVerification,
  deleteEmailListVerification,
  subscribeEmailToList,
} from "@/server/db/dal/email-list";
import { sendEmailListVerificationEmail } from "@/server/email";
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

function createEmailListVerificationUrl(token: string) {
  const url = new URL("/api/email-list/verify", env.NEXT_PUBLIC_BASE_URL);
  url.searchParams.set("token", token);

  return url.toString();
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

  const verification = await createEmailListVerification({
    email: subscription.contact.email,
    listKey: subscription.subscription.listKey,
    subscriptionId: subscription.subscription.id,
  });

  try {
    await sendEmailListVerificationEmail({
      email: subscription.contact.email,
      listKey: subscription.subscription.listKey,
      listName: subscription.list.name,
      verificationUrl: createEmailListVerificationUrl(verification.token),
    });
  } catch {
    await deleteEmailListVerification(verification.token);
    return { status: "delivery-failed" };
  }

  return {
    status: "success",
    verificationRequired,
  };
}
