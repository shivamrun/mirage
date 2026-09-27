CREATE TABLE "mirage_notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" text,
	"archived_at" timestamp with time zone,
	"category" text NOT NULL,
	"data" jsonb NOT NULL,
	"idempotency_key" text,
	"read_at" timestamp with time zone,
	"recipient_id" text NOT NULL,
	"seen_at" timestamp with time zone,
	"subject_id" text,
	"subject_type" text,
	"type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mirage_notification" ADD CONSTRAINT "mirage_notification_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mirage_notification" ADD CONSTRAINT "mirage_notification_recipient_id_user_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mirage_notification_idempotency_key_idx" ON "mirage_notification" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "mirage_notification_recipient_idx" ON "mirage_notification" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "mirage_notification_recipient_created_at_idx" ON "mirage_notification" USING btree ("recipient_id","created_at");--> statement-breakpoint
CREATE INDEX "mirage_notification_recipient_read_at_idx" ON "mirage_notification" USING btree ("recipient_id","read_at");