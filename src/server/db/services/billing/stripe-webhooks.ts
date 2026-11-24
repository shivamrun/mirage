import { analyticsAttributionFromMetadata } from "@/adapters/analytics/events";
import {
  type StripeCheckoutSession,
  type StripeSubscription,
  stripeBillingProvider,
} from "@/adapters/stripe/billing-provider";
import {
  getBillingSubscriptionById,
  getBillingSubscriptionByStripeSubscriptionId,
} from "@/server/db/dal/billing";
import {
  claimStripeWebhookEvent,
  createOrGetStripeWebhookEvent,
  getStripeWebhookEvent,
  markStripeWebhookEventCompleted,
  markStripeWebhookEventFailed,
  markStripeWebhookEventRetrying,
  recordStripeWebhookLifecycleTransition,
} from "@/server/db/dal/stripe-webhook-events";
import {
  handlePaymentFailedInvoice,
  handleSubscriptionCanceled,
  handleSubscriptionStarted,
  handleSubscriptionUpdated,
  invoiceSubscriptionId,
} from "@/server/db/services/billing/lifecycle-events";
import { applySubscriptionStateFromStripeEvent } from "@/server/db/services/billing/stripe-subscriptions";
import { grantCreditTopUpForCheckoutSession } from "@/server/db/services/credits/top-up";
import { getBillingPlanByLookupKey } from "@/shared/billing";

type StripeWebhookEventType =
  | "checkout.session.completed"
  | "checkout.session.async_payment_succeeded"
  | "customer.subscription.created"
  | "customer.subscription.updated"
  | "customer.subscription.deleted"
  | "invoice.paid"
  | "invoice.payment_failed";

function sanitizedError(error: unknown) {
  return {
    kind: error instanceof Error ? error.name : "UnknownError",
    message:
      error instanceof Error ? error.message : "Unknown webhook failure.",
  };
}

class StripeWebhookProcessingError extends Error {
  constructor(
    message: string,
    readonly processingToken: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "StripeWebhookProcessingError";
  }
}

function isCancellationScheduledTransition(
  stripeEvent: Awaited<ReturnType<typeof stripeBillingProvider.retrieveEvent>>,
  stripeSubscription: StripeSubscription,
) {
  const previous = stripeEvent?.data.previous_attributes as
    | { cancel_at_period_end?: unknown }
    | undefined;
  return (
    previous?.cancel_at_period_end === false &&
    stripeSubscription.cancel_at_period_end === true
  );
}

async function processPaidSubscriptionInvoice(
  invoiceId: string,
  eventCreatedAt: number,
) {
  const invoice = await stripeBillingProvider.retrieveInvoice(invoiceId);
  if (
    invoice.billing_reason !== "subscription_create" ||
    invoice.status !== "paid" ||
    invoice.amount_paid <= 0
  )
    return;

  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) return;

  const stripeSubscription =
    await stripeBillingProvider.retrieveSubscription(subscriptionId);
  let localSubscription =
    await getBillingSubscriptionByStripeSubscriptionId(subscriptionId);
  const localId = stripeSubscription.metadata?.subscriptionId;
  if (!localSubscription && localId) {
    const record = await getBillingSubscriptionById(localId);
    const customerId =
      typeof stripeSubscription.customer === "string"
        ? stripeSubscription.customer
        : stripeSubscription.customer.id;
    if (
      record?.stripeCustomerId === customerId &&
      !record.stripeSubscriptionId
    ) {
      localSubscription = record;
    }
  }
  if (!localSubscription) {
    const isMirageSubscription = stripeSubscription.items.data.some((item) =>
      getBillingPlanByLookupKey(item.price.lookup_key),
    );
    if (!isMirageSubscription) return;
    throw new Error("Billing subscription record was not found.");
  }

  const { eventSubscription } = await applySubscriptionStateFromStripeEvent({
    eventCreatedAt,
    localSubscription,
    stripeSubscription,
  });
  if (eventSubscription.status === "active") {
    await handleSubscriptionUpdated(eventSubscription);
  }
  await handleSubscriptionStarted(
    eventSubscription,
    invoice,
    new Date((invoice.status_transitions?.paid_at ?? eventCreatedAt) * 1000),
    analyticsAttributionFromMetadata(
      invoice.parent?.subscription_details?.metadata ??
        stripeSubscription.metadata,
    ),
  );
}

export async function processStripeWebhook({
  eventId,
  eventType,
  objectId,
}: {
  eventId: string;
  eventType: StripeWebhookEventType;
  objectId: string;
}) {
  const record = await createOrGetStripeWebhookEvent({
    eventType,
    objectId,
    stripeEventId: eventId,
  });

  if (record.status === "completed") return record;

  try {
    return await processStoredStripeWebhook({ eventId, eventType, objectId });
  } catch (error) {
    await finalizeStripeWebhookFailure({
      error:
        error instanceof Error ? error : new Error("Stripe webhook failed."),
      payload: { eventId, eventType, objectId },
    });
    throw error;
  }
}

export async function processStoredStripeWebhook(payload: {
  eventId: string;
  eventType: StripeWebhookEventType;
  objectId: string;
}) {
  const existing = await getStripeWebhookEvent(payload.eventId);
  if (!existing) throw new Error("Stripe webhook inbox record was not found.");
  if (existing.status === "completed") return { skipped: true };

  const claimed = await claimStripeWebhookEvent(payload.eventId);
  if (!claimed) {
    const current = await getStripeWebhookEvent(payload.eventId);
    if (current?.status === "completed") return { skipped: true };
    throw new Error("Stripe webhook event is already being processed.");
  }
  const processingToken = claimed.processingToken;
  if (!processingToken) {
    throw new Error("Stripe webhook claim has no processing token.");
  }

  try {
    const stripeEvent = await stripeBillingProvider.retrieveEvent(
      payload.eventId,
    );
    if (!stripeEvent) {
      throw new Error("Stripe webhook event could not be retrieved.");
    }
    const eventObject = stripeEvent.data.object as { id?: unknown } | undefined;
    if (
      stripeEvent.type !== payload.eventType ||
      eventObject?.id !== payload.objectId
    ) {
      throw new Error("Stripe webhook event does not match its inbox record.");
    }

    if (
      payload.eventType === "checkout.session.completed" ||
      payload.eventType === "checkout.session.async_payment_succeeded"
    ) {
      const session = await stripeBillingProvider.retrieveCheckoutSession(
        payload.objectId,
      );
      await grantCreditTopUpForCheckoutSession(
        session as StripeCheckoutSession,
        new Date(stripeEvent.created * 1000),
      );
    } else if (payload.eventType === "invoice.paid") {
      await processPaidSubscriptionInvoice(
        payload.objectId,
        stripeEvent.created,
      );
    } else if (payload.eventType === "invoice.payment_failed") {
      const invoice = await stripeBillingProvider.retrieveInvoice(
        payload.objectId,
      );
      await handlePaymentFailedInvoice(invoice, payload.eventId);
    } else {
      const localSubscription =
        await getBillingSubscriptionByStripeSubscriptionId(payload.objectId);
      if (!localSubscription) {
        throw new Error("Billing subscription record was not found.");
      }
      const stripeSubscription = stripeEvent.data.object as StripeSubscription;
      const { applied, eventSubscription } =
        await applySubscriptionStateFromStripeEvent({
          eventCreatedAt: stripeEvent.created,
          localSubscription,
          stripeSubscription,
        });
      if (applied) {
        await handleSubscriptionUpdated(eventSubscription);
      }
      if (
        payload.eventType === "customer.subscription.updated" &&
        isCancellationScheduledTransition(stripeEvent, stripeSubscription)
      ) {
        await handleSubscriptionCanceled(
          eventSubscription,
          payload.eventId,
          new Date(stripeEvent.created * 1000),
        );
        await recordStripeWebhookLifecycleTransition({
          processingToken,
          stripeEventId: payload.eventId,
        });
      }
    }
    const completed = await markStripeWebhookEventCompleted({
      processingToken,
      stripeEventId: payload.eventId,
    });
    return { skipped: !completed };
  } catch (error) {
    const failure = sanitizedError(error);
    await markStripeWebhookEventRetrying({
      errorKind: failure.kind,
      errorMessage: failure.message,
      processingToken,
      stripeEventId: payload.eventId,
    });
    throw new StripeWebhookProcessingError(failure.message, processingToken, {
      cause: error,
    });
  }
}

export async function finalizeStripeWebhookFailure({
  error,
  payload,
}: {
  error: Error;
  payload: {
    eventId: string;
    eventType: StripeWebhookEventType;
    objectId: string;
  };
}) {
  if (!(error instanceof StripeWebhookProcessingError)) return;
  await markStripeWebhookEventFailed({
    errorKind: error.name,
    errorMessage: error.message,
    processingToken: error.processingToken,
    stripeEventId: payload.eventId,
  });
}
