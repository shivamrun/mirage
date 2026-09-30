CREATE TABLE "mirage_stripe_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"event_type" text NOT NULL,
	"last_error_kind" text,
	"last_error_message" text,
	"object_id" text NOT NULL,
	"processed_at" timestamp with time zone,
	"status" text DEFAULT 'pending' NOT NULL,
	"stripe_event_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "stripe_webhook_events_event_id_unique" ON "mirage_stripe_webhook_events" USING btree ("stripe_event_id");--> statement-breakpoint
CREATE INDEX "stripe_webhook_events_status_created_idx" ON "mirage_stripe_webhook_events" USING btree ("status","created_at");