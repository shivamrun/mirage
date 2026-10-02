CREATE TABLE "mirage_billing_credit_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"request_id" uuid NOT NULL,
	"package_key" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"credits" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"stripe_checkout_session_id" text,
	"stripe_payment_intent_id" text,
	"paid_at" timestamp with time zone,
	"fulfilled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "subscription_stripeSubscriptionId_idx";--> statement-breakpoint
ALTER TABLE "mirage_credit_ledger_entries" ADD COLUMN "operation_fingerprint" text;--> statement-breakpoint
ALTER TABLE "mirage_stripe_webhook_events" ADD COLUMN "processing_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mirage_billing_credit_purchases" ADD CONSTRAINT "mirage_billing_credit_purchases_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_credit_purchases_request_id_unique" ON "mirage_billing_credit_purchases" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_credit_purchases_checkout_session_unique" ON "mirage_billing_credit_purchases" USING btree ("stripe_checkout_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_credit_purchases_payment_intent_unique" ON "mirage_billing_credit_purchases" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "billing_credit_purchases_user_created_idx" ON "mirage_billing_credit_purchases" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "billing_credit_purchases_status_created_idx" ON "mirage_billing_credit_purchases" USING btree ("status","created_at");--> statement-breakpoint
ALTER TABLE "mirage_credit_ledger_entries" ADD CONSTRAINT "mirage_credit_ledger_entries_reverses_ledger_entry_id_mirage_credit_ledger_entries_id_fk" FOREIGN KEY ("reverses_ledger_entry_id") REFERENCES "public"."mirage_credit_ledger_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_stripeSubscriptionId_unique" ON "subscription" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "credit_ledger_entries_reversal_idx" ON "mirage_credit_ledger_entries" USING btree ("reverses_ledger_entry_id");