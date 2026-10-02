ALTER TABLE "subscription" ADD COLUMN "stripe_event_created_at" integer;--> statement-breakpoint
ALTER TABLE "mirage_stripe_webhook_events" ADD COLUMN "processing_token" text;--> statement-breakpoint
ALTER TABLE "mirage_stripe_webhook_events" ADD COLUMN "lifecycle_recorded_at" timestamp with time zone;