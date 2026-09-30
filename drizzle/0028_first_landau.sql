CREATE TABLE "mirage_email_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"data" jsonb NOT NULL,
	"idempotency_key" text NOT NULL,
	"last_error_kind" text,
	"notification_type" text NOT NULL,
	"provider_message_id" text,
	"recipient_id" text,
	"sent_at" timestamp with time zone,
	"status" text DEFAULT 'pending' NOT NULL,
	"subject_id" text,
	"subject_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "email_deliveries_idempotency_key_unique" ON "mirage_email_deliveries" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "email_deliveries_status_created_idx" ON "mirage_email_deliveries" USING btree ("status","created_at");