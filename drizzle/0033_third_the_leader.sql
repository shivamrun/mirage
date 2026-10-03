ALTER TABLE "mirage_account_deletion_requests" RENAME TO "account_deletion_requests";--> statement-breakpoint
ALTER TABLE "mirage_user_data_exports" RENAME TO "user_data_exports";--> statement-breakpoint
ALTER TABLE "adminSessionAssurance" RENAME TO "admin_session_assurance";--> statement-breakpoint
ALTER TABLE "referralCode" RENAME TO "referral_code";--> statement-breakpoint
ALTER TABLE "referralStepCompletion" RENAME TO "referral_step_completion";--> statement-breakpoint
ALTER TABLE "twoFactor" RENAME TO "two_factor";--> statement-breakpoint
ALTER TABLE "mirage_billing_credit_purchases" RENAME TO "billing_credit_purchases";--> statement-breakpoint
ALTER TABLE "mirage_contact_submission" RENAME TO "contact_submission";--> statement-breakpoint
ALTER TABLE "mirage_credit_accounts" RENAME TO "credit_accounts";--> statement-breakpoint
ALTER TABLE "mirage_credit_ledger_entries" RENAME TO "credit_ledger_entries";--> statement-breakpoint
ALTER TABLE "mirage_credit_period_grants" RENAME TO "credit_period_grants";--> statement-breakpoint
ALTER TABLE "mirage_email_deliveries" RENAME TO "email_deliveries";--> statement-breakpoint
ALTER TABLE "mirage_email_contact" RENAME TO "email_contact";--> statement-breakpoint
ALTER TABLE "mirage_email_list" RENAME TO "email_list";--> statement-breakpoint
ALTER TABLE "mirage_email_subscription" RENAME TO "email_subscription";--> statement-breakpoint
ALTER TABLE "mirage_invitation" RENAME TO "invitation";--> statement-breakpoint
ALTER TABLE "mirage_notification" RENAME TO "notification";--> statement-breakpoint
ALTER TABLE "mirage_rate_limit" RENAME TO "rate_limit";--> statement-breakpoint
ALTER TABLE "mirage_auth_rate_limit" RENAME TO "auth_rate_limit";--> statement-breakpoint
ALTER TABLE "mirage_stripe_webhook_events" RENAME TO "stripe_webhook_events";--> statement-breakpoint
ALTER TABLE "referral_code" DROP CONSTRAINT "referralCode_user_id_unique";--> statement-breakpoint
ALTER TABLE "referral_code" DROP CONSTRAINT "referralCode_code_unique";--> statement-breakpoint
ALTER TABLE "referral_step_completion" DROP CONSTRAINT "referralStepCompletion_completion_key_unique";--> statement-breakpoint
ALTER TABLE "email_contact" DROP CONSTRAINT "mirage_email_contact_email_unique";--> statement-breakpoint
ALTER TABLE "auth_rate_limit" DROP CONSTRAINT "mirage_auth_rate_limit_key_unique";--> statement-breakpoint
ALTER TABLE "account_deletion_requests" DROP CONSTRAINT "mirage_account_deletion_requests_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "user_data_exports" DROP CONSTRAINT "mirage_user_data_exports_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "admin_session_assurance" DROP CONSTRAINT "adminSessionAssurance_session_id_session_id_fk";
--> statement-breakpoint
ALTER TABLE "admin_session_assurance" DROP CONSTRAINT "adminSessionAssurance_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "referral_code" DROP CONSTRAINT "referralCode_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "referral_step_completion" DROP CONSTRAINT "referralStepCompletion_referral_id_referrals_id_fk";
--> statement-breakpoint
ALTER TABLE "referrals" DROP CONSTRAINT "referrals_referral_code_id_referralCode_id_fk";
--> statement-breakpoint
ALTER TABLE "two_factor" DROP CONSTRAINT "twoFactor_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "billing_credit_purchases" DROP CONSTRAINT "mirage_billing_credit_purchases_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "credit_accounts" DROP CONSTRAINT "mirage_credit_accounts_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "credit_ledger_entries" DROP CONSTRAINT "mirage_credit_ledger_entries_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "credit_ledger_entries" DROP CONSTRAINT "mirage_credit_ledger_entries_reverses_ledger_entry_id_mirage_credit_ledger_entries_id_fk";
--> statement-breakpoint
ALTER TABLE "credit_period_grants" DROP CONSTRAINT "mirage_credit_period_grants_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "email_subscription" DROP CONSTRAINT "mirage_email_subscription_contact_id_mirage_email_contact_id_fk";
--> statement-breakpoint
ALTER TABLE "email_subscription" DROP CONSTRAINT "mirage_email_subscription_list_key_mirage_email_list_key_fk";
--> statement-breakpoint
ALTER TABLE "invitation" DROP CONSTRAINT "mirage_invitation_invited_by_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "invitation" DROP CONSTRAINT "mirage_invitation_accepted_by_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "notification" DROP CONSTRAINT "mirage_notification_actor_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "notification" DROP CONSTRAINT "mirage_notification_recipient_id_user_id_fk";
--> statement-breakpoint
DROP INDEX "adminSessionAssurance_sessionId_idx";--> statement-breakpoint
DROP INDEX "adminSessionAssurance_userId_idx";--> statement-breakpoint
DROP INDEX "account_userId_idx";--> statement-breakpoint
DROP INDEX "referralCode_userId_idx";--> statement-breakpoint
DROP INDEX "referralCode_code_idx";--> statement-breakpoint
DROP INDEX "referralStepCompletion_referralId_idx";--> statement-breakpoint
DROP INDEX "referralStepCompletion_completionKey_idx";--> statement-breakpoint
DROP INDEX "referrals_referrerUserId_idx";--> statement-breakpoint
DROP INDEX "referrals_referredUserId_idx";--> statement-breakpoint
DROP INDEX "referrals_referralCodeId_idx";--> statement-breakpoint
DROP INDEX "referrals_createdAt_idx";--> statement-breakpoint
DROP INDEX "session_userId_idx";--> statement-breakpoint
DROP INDEX "subscription_referenceId_idx";--> statement-breakpoint
DROP INDEX "subscription_stripeCustomerId_idx";--> statement-breakpoint
DROP INDEX "subscription_stripeSubscriptionId_unique";--> statement-breakpoint
DROP INDEX "twoFactor_secret_idx";--> statement-breakpoint
DROP INDEX "twoFactor_userId_idx";--> statement-breakpoint
DROP INDEX "mirage_invitation_email_idx";--> statement-breakpoint
DROP INDEX "mirage_invitation_status_idx";--> statement-breakpoint
DROP INDEX "mirage_invitation_expiresAt_idx";--> statement-breakpoint
DROP INDEX "mirage_invitation_tokenHash_idx";--> statement-breakpoint
DROP INDEX "mirage_invitation_invitedByUserId_idx";--> statement-breakpoint
DROP INDEX "mirage_invitation_acceptedByUserId_idx";--> statement-breakpoint
DROP INDEX "mirage_notification_idempotency_key_idx";--> statement-breakpoint
DROP INDEX "mirage_notification_recipient_idx";--> statement-breakpoint
DROP INDEX "mirage_notification_recipient_created_at_idx";--> statement-breakpoint
DROP INDEX "mirage_notification_recipient_read_at_idx";--> statement-breakpoint
DROP INDEX "account_deletion_requests_deleting_user_unique";--> statement-breakpoint
DROP INDEX "user_data_exports_active_user_unique";--> statement-breakpoint
ALTER TABLE "rate_limit" DROP CONSTRAINT "mirage_rate_limit_scope_identifier_hash_pk";--> statement-breakpoint
ALTER TABLE "rate_limit" ADD CONSTRAINT "rate_limit_scope_identifier_hash_pk" PRIMARY KEY("scope","identifier_hash");--> statement-breakpoint
ALTER TABLE "account_deletion_requests" ADD CONSTRAINT "account_deletion_requests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_data_exports" ADD CONSTRAINT "user_data_exports_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_session_assurance" ADD CONSTRAINT "admin_session_assurance_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_session_assurance" ADD CONSTRAINT "admin_session_assurance_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_code" ADD CONSTRAINT "referral_code_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_step_completion" ADD CONSTRAINT "referral_step_completion_referral_id_referrals_id_fk" FOREIGN KEY ("referral_id") REFERENCES "public"."referrals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referral_code_id_referral_code_id_fk" FOREIGN KEY ("referral_code_id") REFERENCES "public"."referral_code"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_credit_purchases" ADD CONSTRAINT "billing_credit_purchases_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_accounts" ADD CONSTRAINT "credit_accounts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_reverses_ledger_entry_id_credit_ledger_entries_id_fk" FOREIGN KEY ("reverses_ledger_entry_id") REFERENCES "public"."credit_ledger_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_period_grants" ADD CONSTRAINT "credit_period_grants_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_subscription" ADD CONSTRAINT "email_subscription_contact_id_email_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."email_contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_subscription" ADD CONSTRAINT "email_subscription_list_key_email_list_key_fk" FOREIGN KEY ("list_key") REFERENCES "public"."email_list"("key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_accepted_by_user_id_user_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_recipient_id_user_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_session_assurance_session_id_idx" ON "admin_session_assurance" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "admin_session_assurance_user_id_idx" ON "admin_session_assurance" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "referral_code_user_id_idx" ON "referral_code" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "referral_code_code_idx" ON "referral_code" USING btree ("code");--> statement-breakpoint
CREATE INDEX "referral_step_completion_referral_id_idx" ON "referral_step_completion" USING btree ("referral_id");--> statement-breakpoint
CREATE INDEX "referral_step_completion_completion_key_idx" ON "referral_step_completion" USING btree ("completion_key");--> statement-breakpoint
CREATE INDEX "referrals_referrer_user_id_idx" ON "referrals" USING btree ("referrer_user_id");--> statement-breakpoint
CREATE INDEX "referrals_referred_user_id_idx" ON "referrals" USING btree ("referred_user_id");--> statement-breakpoint
CREATE INDEX "referrals_referral_code_id_idx" ON "referrals" USING btree ("referral_code_id");--> statement-breakpoint
CREATE INDEX "referrals_created_at_idx" ON "referrals" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscription_reference_id_idx" ON "subscription" USING btree ("reference_id");--> statement-breakpoint
CREATE INDEX "subscription_stripe_customer_id_idx" ON "subscription" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_stripe_subscription_id_unique" ON "subscription" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "two_factor_secret_idx" ON "two_factor" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "two_factor_user_id_idx" ON "two_factor" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "invitation_status_idx" ON "invitation" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invitation_expires_at_idx" ON "invitation" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "invitation_token_hash_idx" ON "invitation" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "invitation_invited_by_user_id_idx" ON "invitation" USING btree ("invited_by_user_id");--> statement-breakpoint
CREATE INDEX "invitation_accepted_by_user_id_idx" ON "invitation" USING btree ("accepted_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_idempotency_key_idx" ON "notification" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "notification_recipient_idx" ON "notification" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "notification_recipient_created_at_idx" ON "notification" USING btree ("recipient_id","created_at");--> statement-breakpoint
CREATE INDEX "notification_recipient_read_at_idx" ON "notification" USING btree ("recipient_id","read_at");--> statement-breakpoint
CREATE UNIQUE INDEX "account_deletion_requests_deleting_user_unique" ON "account_deletion_requests" USING btree ("user_id") WHERE "account_deletion_requests"."user_id" is not null and "account_deletion_requests"."state" = 'deleting';--> statement-breakpoint
CREATE UNIQUE INDEX "user_data_exports_active_user_unique" ON "user_data_exports" USING btree ("user_id") WHERE "user_data_exports"."user_id" is not null and "user_data_exports"."status" in ('pending', 'processing', 'failed');--> statement-breakpoint
ALTER TABLE "referral_code" ADD CONSTRAINT "referral_code_user_id_unique" UNIQUE("user_id");--> statement-breakpoint
ALTER TABLE "referral_code" ADD CONSTRAINT "referral_code_code_unique" UNIQUE("code");--> statement-breakpoint
ALTER TABLE "referral_step_completion" ADD CONSTRAINT "referral_step_completion_completion_key_unique" UNIQUE("completion_key");--> statement-breakpoint
ALTER TABLE "email_contact" ADD CONSTRAINT "email_contact_email_unique" UNIQUE("email");--> statement-breakpoint
ALTER TABLE "auth_rate_limit" ADD CONSTRAINT "auth_rate_limit_key_unique" UNIQUE("key");