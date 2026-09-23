CREATE TABLE "mirage_billing_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"stripe_price_id" text NOT NULL,
	"stripe_annual_discount_price_id" text,
	"group" text,
	"limits" jsonb,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "billing_plan_name_idx" ON "mirage_billing_plan" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_plan_stripePriceId_idx" ON "mirage_billing_plan" USING btree ("stripe_price_id");--> statement-breakpoint
CREATE INDEX "billing_plan_active_sort_idx" ON "mirage_billing_plan" USING btree ("active","sort_order");