CREATE TABLE "mirage_credit_accounts" (
	"user_id" text PRIMARY KEY NOT NULL,
	"available_credits" integer DEFAULT 0 NOT NULL,
	"lifetime_granted" integer DEFAULT 0 NOT NULL,
	"lifetime_spent" integer DEFAULT 0 NOT NULL,
	"lifetime_expired" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mirage_credit_ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"amount" integer NOT NULL,
	"type" text NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"idempotency_key" text NOT NULL,
	"source" text NOT NULL,
	"source_id" text,
	"reverses_ledger_entry_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mirage_credit_period_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"plan" text NOT NULL,
	"allowance" integer NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"subscription_id" text,
	"period_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mirage_credit_accounts" ADD CONSTRAINT "mirage_credit_accounts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mirage_credit_ledger_entries" ADD CONSTRAINT "mirage_credit_ledger_entries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mirage_credit_period_grants" ADD CONSTRAINT "mirage_credit_period_grants_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_entries_idempotency_key_unique" ON "mirage_credit_ledger_entries" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "credit_ledger_entries_user_created_idx" ON "mirage_credit_ledger_entries" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "credit_ledger_entries_period_end_idx" ON "mirage_credit_ledger_entries" USING btree ("period_end");--> statement-breakpoint
CREATE INDEX "credit_ledger_entries_source_idx" ON "mirage_credit_ledger_entries" USING btree ("source","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_period_grants_period_key_unique" ON "mirage_credit_period_grants" USING btree ("period_key");--> statement-breakpoint
CREATE INDEX "credit_period_grants_user_period_idx" ON "mirage_credit_period_grants" USING btree ("user_id","period_start","period_end");--> statement-breakpoint
CREATE INDEX "credit_period_grants_subscription_idx" ON "mirage_credit_period_grants" USING btree ("subscription_id");