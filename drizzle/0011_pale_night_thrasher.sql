ALTER TABLE "twoFactor" ALTER COLUMN "verified" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "twoFactor" ALTER COLUMN "failed_verification_count" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "two_factor_enabled" SET NOT NULL;