CREATE TABLE "referralCode" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referralCode_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "referralCode_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "referralStepCompletion" (
	"id" text PRIMARY KEY NOT NULL,
	"referral_id" text NOT NULL,
	"step" text NOT NULL,
	"completion_key" text NOT NULL,
	"metadata" jsonb,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referralStepCompletion_completion_key_unique" UNIQUE("completion_key")
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" text PRIMARY KEY NOT NULL,
	"referrer_user_id" text NOT NULL,
	"referred_user_id" text NOT NULL,
	"referral_code_id" text NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referrals_referred_user_id_unique" UNIQUE("referred_user_id")
);
--> statement-breakpoint
ALTER TABLE "referralCode" ADD CONSTRAINT "referralCode_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referralStepCompletion" ADD CONSTRAINT "referralStepCompletion_referral_id_referrals_id_fk" FOREIGN KEY ("referral_id") REFERENCES "public"."referrals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_user_id_user_id_fk" FOREIGN KEY ("referrer_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_user_id_user_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referral_code_id_referralCode_id_fk" FOREIGN KEY ("referral_code_id") REFERENCES "public"."referralCode"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "referralCode_userId_idx" ON "referralCode" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "referralCode_code_idx" ON "referralCode" USING btree ("code");--> statement-breakpoint
CREATE INDEX "referralStepCompletion_referralId_idx" ON "referralStepCompletion" USING btree ("referral_id");--> statement-breakpoint
CREATE INDEX "referralStepCompletion_completionKey_idx" ON "referralStepCompletion" USING btree ("completion_key");--> statement-breakpoint
CREATE INDEX "referrals_referrerUserId_idx" ON "referrals" USING btree ("referrer_user_id");--> statement-breakpoint
CREATE INDEX "referrals_referredUserId_idx" ON "referrals" USING btree ("referred_user_id");--> statement-breakpoint
CREATE INDEX "referrals_referralCodeId_idx" ON "referrals" USING btree ("referral_code_id");--> statement-breakpoint
CREATE INDEX "referrals_status_idx" ON "referrals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "referrals_createdAt_idx" ON "referrals" USING btree ("created_at");