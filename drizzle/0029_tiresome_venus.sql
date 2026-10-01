CREATE TABLE "mirage_account_deletion_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"audit_subject_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"state" text DEFAULT 'deleting' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleting_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cleanup_phase" text,
	"failure_kind" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mirage_user_data_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"delivery_due_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"checksum" text,
	"size_bytes" bigint,
	"ready_at" timestamp with time zone,
	"failure_kind" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mirage_account_deletion_requests" ADD CONSTRAINT "mirage_account_deletion_requests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mirage_user_data_exports" ADD CONSTRAINT "mirage_user_data_exports_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_deletion_requests_deleting_user_unique" ON "mirage_account_deletion_requests" USING btree ("user_id") WHERE "mirage_account_deletion_requests"."user_id" is not null and "mirage_account_deletion_requests"."state" = 'deleting';--> statement-breakpoint
CREATE INDEX "account_deletion_requests_state_idx" ON "mirage_account_deletion_requests" USING btree ("state");--> statement-breakpoint
CREATE UNIQUE INDEX "user_data_exports_active_user_unique" ON "mirage_user_data_exports" USING btree ("user_id") WHERE "mirage_user_data_exports"."user_id" is not null and "mirage_user_data_exports"."status" in ('pending', 'processing', 'failed');--> statement-breakpoint
CREATE INDEX "user_data_exports_status_due_idx" ON "mirage_user_data_exports" USING btree ("status","delivery_due_at");