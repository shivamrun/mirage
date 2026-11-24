CREATE TABLE "billing_analytics" (
	"key" text PRIMARY KEY NOT NULL,
	"event" jsonb,
	"occurred_at" timestamp with time zone NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"claim_token" text,
	"delivered_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "billing_analytics_available_idx" ON "billing_analytics" USING btree ("available_at");