import { isDeepStrictEqual } from "node:util";

import { and, eq, inArray, lt, or, sql } from "drizzle-orm";

import type { NotificationDeliveryInput } from "@/features/notifications/channels/types";
import db from "@/server/db";
import { emailDeliveries } from "@/server/db/schema";

export async function createOrGetEmailDelivery(
  input: NotificationDeliveryInput & { idempotencyKey: string },
) {
  const [created] = await db
    .insert(emailDeliveries)
    .values({
      data: input.data,
      idempotencyKey: input.idempotencyKey,
      notificationType: input.type,
      recipientId: input.recipientId,
      subjectId: input.subject?.id,
      subjectType: input.subject?.type,
    })
    .onConflictDoNothing({ target: emailDeliveries.idempotencyKey })
    .returning();
  if (created) return created;

  const [existing] = await db
    .select()
    .from(emailDeliveries)
    .where(eq(emailDeliveries.idempotencyKey, input.idempotencyKey))
    .limit(1);
  if (!existing)
    throw new Error("Email delivery conflict could not be resolved.");
  if (
    !isDeepStrictEqual(existing.data, input.data) ||
    existing.notificationType !== input.type ||
    existing.recipientId !== (input.recipientId ?? null) ||
    existing.subjectId !== (input.subject?.id ?? null) ||
    existing.subjectType !== (input.subject?.type ?? null)
  ) {
    throw new Error(
      "Email idempotency key was reused for another notification.",
    );
  }
  return existing;
}

export async function getEmailDelivery(id: string) {
  const [delivery] = await db
    .select()
    .from(emailDeliveries)
    .where(eq(emailDeliveries.id, id))
    .limit(1);
  return delivery ?? null;
}

export async function markEmailDeliveryProcessing(id: string) {
  const staleBefore = new Date(Date.now() - 5 * 60_000);
  const [delivery] = await db
    .update(emailDeliveries)
    .set({
      attemptCount: sql`${emailDeliveries.attemptCount} + 1`,
      lastErrorKind: null,
      status: "processing",
    })
    .where(
      and(
        eq(emailDeliveries.id, id),
        or(
          inArray(emailDeliveries.status, ["pending", "failed"]),
          and(
            eq(emailDeliveries.status, "processing"),
            lt(emailDeliveries.updatedAt, staleBefore),
          ),
        ),
      ),
    )
    .returning();
  return delivery ?? null;
}

export async function markEmailDeliverySent(
  id: string,
  providerMessageId: null | string,
) {
  await db
    .update(emailDeliveries)
    .set({ providerMessageId, sentAt: new Date(), status: "sent" })
    .where(eq(emailDeliveries.id, id));
}

export async function markEmailDeliveryRetrying(id: string, errorKind: string) {
  await db
    .update(emailDeliveries)
    .set({ lastErrorKind: errorKind, status: "pending" })
    .where(eq(emailDeliveries.id, id));
}
