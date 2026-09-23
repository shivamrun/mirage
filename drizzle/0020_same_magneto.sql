ALTER TABLE "mirage_billing_plan" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "mirage_billing_plan" ADD COLUMN "benefits" jsonb;--> statement-breakpoint
ALTER TABLE "mirage_billing_plan" ADD COLUMN "entitlements" jsonb;