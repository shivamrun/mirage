import type Stripe from "stripe";
import { getBillingStripeClient } from "./client";

export type CreditCheckoutInput = {
  cancelUrl: string;
  customerEmail: string;
  idempotencyKey: string;
  metadata: Record<string, string>;
  priceId: string;
  stripeCustomerId?: null | string;
  successUrl: string;
  userId: string;
};

export const stripeBillingProvider = {
  async cancelSubscription(subscriptionId: string) {
    return getBillingStripeClient().subscriptions.cancel(subscriptionId);
  },

  async createCreditCheckout(input: CreditCheckoutInput) {
    return getBillingStripeClient().checkout.sessions.create(
      {
        cancel_url: input.cancelUrl,
        client_reference_id: input.userId,
        customer: input.stripeCustomerId ?? undefined,
        customer_email: input.stripeCustomerId
          ? undefined
          : input.customerEmail,
        invoice_creation: {
          enabled: true,
          invoice_data: {
            description: "Mirage credit top-up",
            metadata: input.metadata,
          },
        },
        line_items: [{ price: input.priceId, quantity: 1 }],
        metadata: input.metadata,
        mode: "payment",
        success_url: input.successUrl,
      },
      { idempotencyKey: input.idempotencyKey },
    );
  },

  async deleteCustomer(customerId: string) {
    return getBillingStripeClient().customers.del(customerId);
  },

  async getPriceByLookupKey(lookupKey: string) {
    const prices = await getBillingStripeClient().prices.list({
      active: true,
      expand: ["data.product"],
      limit: 1,
      lookup_keys: [lookupKey],
    });
    return prices.data[0] ?? null;
  },

  async listCheckoutLineItems(sessionId: string) {
    return getBillingStripeClient().checkout.sessions.listLineItems(sessionId, {
      expand: ["data.price"],
      limit: 1,
    });
  },

  async listInvoices(customerId: string) {
    return getBillingStripeClient().invoices.list({
      customer: customerId,
      expand: ["data.lines.data.pricing.price_details.price"],
      limit: 10,
    });
  },

  async retrieveCheckoutSession(sessionId: string) {
    return getBillingStripeClient().checkout.sessions.retrieve(sessionId);
  },

  async retrieveEvent(eventId: string) {
    // Compatibility for the narrow Stripe doubles used by legacy tests. The
    // production client always exposes `events.retrieve`.
    return getBillingStripeClient().events?.retrieve(eventId) ?? null;
  },

  async retrieveInvoice(invoiceId: string) {
    return getBillingStripeClient().invoices.retrieve(invoiceId);
  },

  async retrieveSubscription(subscriptionId: string) {
    return getBillingStripeClient().subscriptions.retrieve(subscriptionId);
  },
};

export type StripeBillingProvider = typeof stripeBillingProvider;
export type StripeCheckoutSession = Stripe.Checkout.Session;
export type StripeEvent = Stripe.Event;
export type StripeInvoice = Stripe.Invoice;
export type StripeMetadata = Stripe.Metadata;
export type StripePrice = Stripe.Price;
export type StripeSubscription = Stripe.Subscription;
export type StripeSubscriptionItem = Stripe.SubscriptionItem;
