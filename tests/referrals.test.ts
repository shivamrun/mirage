import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { auth } from "@/features/auth/better-auth/server";
import db from "@/server/db";
import {
  creditLedgerEntries,
  notification,
  referrals,
  user,
} from "@/server/db/schema";
import {
  type NotificationSubscription,
  subscribe,
} from "@/server/db/services/notifications/realtime-broker";
import { notificationRealtimeEventNames } from "@/shared/schemas/notifications";
import { createTestActor } from "./infra/admin-actor";
import { testEmailOutbox } from "./infra/email-fake";

const origin = "http://localhost:3000";
const password = "TestPassword123!";

async function authRequest(
  path: string,
  {
    body,
    cookie,
    headers = {},
    method = "GET",
  }: {
    body?: object;
    cookie?: string;
    headers?: Record<string, string>;
    method?: string;
  } = {},
) {
  return auth.handler(
    new Request(`${origin}/api/auth${path}`, {
      method,
      headers: {
        ...headers,
        ...(cookie ? { cookie } : {}),
        ...(body ? { "content-type": "application/json" } : {}),
        origin,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
  );
}

async function referralCodeFor(cookie: string) {
  const response = await authRequest("/referrals", { cookie });
  expect(response.status).toBe(200);

  const dashboard = (await response.json()) as { code: string };
  return dashboard.code;
}

async function signUpWithReferral(referralCode: string) {
  const email = `referred-${crypto.randomUUID()}@example.com`;
  const response = await authRequest("/sign-up/email", {
    method: "POST",
    headers: { "x-referral-code": referralCode },
    body: {
      agreeToTerms: true,
      email,
      password,
    },
  });

  expect(response.status).toBe(200);

  const [record] = await db.select().from(user).where(eq(user.email, email));
  expect(record).toBeTruthy();

  return record;
}

async function nextCreatedEvent(subscription: NotificationSubscription) {
  const deadline = Date.now() + 1000;

  while (Date.now() < deadline) {
    const event = await Promise.race([
      subscription.next(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 25)),
    ]);

    if (event?.event === notificationRealtimeEventNames.created) {
      return event;
    }

    if (event === null) {
      subscription.cancelNext();
    }
  }

  throw new Error("Timed out waiting for notification.created.");
}

describe("referral rewards", () => {
  it("notifies on referred signup and rewards both users after completion", async () => {
    const referrer = await createTestActor({ emailVerified: true });
    const referralCode = await referralCodeFor(referrer.cookie);
    testEmailOutbox.length = 0;

    const subscription = subscribe(referrer.id);
    let referred: Awaited<ReturnType<typeof signUpWithReferral>>;
    let createdEvent: Awaited<ReturnType<typeof nextCreatedEvent>>;

    try {
      referred = await signUpWithReferral(referralCode);
      createdEvent = await nextCreatedEvent(subscription);
    } finally {
      subscription.close();
    }

    expect(createdEvent.data.notification).toMatchObject({
      recipientId: referrer.id,
      subjectId: referred.id,
      subjectType: "user",
      type: "referrals.signup_recorded",
    });

    const signupNotifications = await db
      .select()
      .from(notification)
      .where(eq(notification.recipientId, referrer.id));
    expect(signupNotifications).toHaveLength(1);
    expect(signupNotifications[0]).toMatchObject({
      idempotencyKey: `referral:signup:${referred.id}`,
      type: "referrals.signup_recorded",
    });

    const [createdReferral] = await db
      .select()
      .from(referrals)
      .where(eq(referrals.referredUserId, referred.id));
    expect(createdReferral).toMatchObject({
      referrerUserId: referrer.id,
      referredUserId: referred.id,
      status: "pending",
    });

    await auth.api.markReferralStepComplete({
      body: {
        referredUserId: referred.id,
        step: "email_verified",
      },
    });
    await auth.api.markReferralStepComplete({
      body: {
        referredUserId: referred.id,
        step: "email_verified",
      },
    });

    const rewardEntries = await db
      .select()
      .from(creditLedgerEntries)
      .where(eq(creditLedgerEntries.source, "referral_reward"));

    expect(rewardEntries).toHaveLength(2);
    expect(rewardEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          amount: 50,
          idempotencyKey: `referral:reward:${createdReferral.id}:referrer`,
          sourceId: createdReferral.id,
          type: "top_up",
          userId: referrer.id,
        }),
        expect.objectContaining({
          amount: 50,
          idempotencyKey: `referral:reward:${createdReferral.id}:referred`,
          sourceId: createdReferral.id,
          type: "top_up",
          userId: referred.id,
        }),
      ]),
    );

    const [completedReferral] = await db
      .select()
      .from(referrals)
      .where(eq(referrals.id, createdReferral.id));
    expect(completedReferral?.status).toBe("completed");
    expect(completedReferral?.completedAt).toBeTruthy();

    const completionEmails = testEmailOutbox.filter(
      (email) => email.subject === "Your Mirage referral reward is ready",
    );
    expect(completionEmails).toHaveLength(1);
    expect(completionEmails[0]).toMatchObject({
      to: referrer.email,
    });
  });
});
