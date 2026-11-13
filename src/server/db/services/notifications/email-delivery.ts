import { emailNotificationChannel } from "@/features/notifications/channels/email";
import type { NotificationDeliveryInput } from "@/features/notifications/channels/types";
import { getNotificationDefinition } from "@/features/notifications/registry/registry";
import {
  createOrGetEmailDelivery,
  getEmailDelivery,
  markEmailDeliveryProcessing,
  markEmailDeliveryRetrying,
  markEmailDeliverySent,
} from "@/server/db/dal/email-deliveries";

export async function enqueueEmailDelivery(
  input: NotificationDeliveryInput & { idempotencyKey: string },
) {
  const delivery = await createOrGetEmailDelivery(input);
  if (delivery.status === "sent") return delivery;

  await processEmailDelivery(delivery.id);
  return delivery;
}

export async function processEmailDelivery(deliveryId: string) {
  const delivery = await getEmailDelivery(deliveryId);
  if (!delivery) throw new Error("Email delivery record was not found.");
  if (delivery.status === "sent") return { skipped: true };

  const claimed = await markEmailDeliveryProcessing(delivery.id);
  if (!claimed) return { skipped: true };
  try {
    const result = await emailNotificationChannel.deliver({
      category: getNotificationDefinition(delivery.notificationType).category,
      data: delivery.data,
      idempotencyKey: delivery.idempotencyKey,
      recipientId: delivery.recipientId ?? undefined,
      subject:
        delivery.subjectId && delivery.subjectType
          ? { id: delivery.subjectId, type: delivery.subjectType }
          : undefined,
      type: delivery.notificationType,
    });
    await markEmailDeliverySent(
      delivery.id,
      result.email?.skipped ? null : (result.email?.id ?? null),
    );
    return { skipped: false };
  } catch (error) {
    await markEmailDeliveryRetrying(
      delivery.id,
      error instanceof Error ? error.name : "UnknownError",
    );
    throw error instanceof Error ? error : new Error("Email delivery failed.");
  }
}
