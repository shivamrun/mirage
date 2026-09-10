CREATE TABLE "mirage_email_contact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mirage_email_contact_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "mirage_email_subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"list_key" text NOT NULL,
	"status" text DEFAULT 'subscribed' NOT NULL,
	"source" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mirage_email_subscription" ADD CONSTRAINT "mirage_email_subscription_contact_id_mirage_email_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."mirage_email_contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_subscription_contact_list_unique" ON "mirage_email_subscription" USING btree ("contact_id","list_key");--> statement-breakpoint
CREATE INDEX "email_subscription_list_status_idx" ON "mirage_email_subscription" USING btree ("list_key","status");