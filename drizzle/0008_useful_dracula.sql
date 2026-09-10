CREATE TABLE "mirage_email_list" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "mirage_email_list" ("key", "name", "description", "status")
VALUES ('waitlist', 'Waitlist', 'Early access and product update signups.', 'active')
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "mirage_email_subscription" ADD CONSTRAINT "mirage_email_subscription_list_key_mirage_email_list_key_fk" FOREIGN KEY ("list_key") REFERENCES "public"."mirage_email_list"("key") ON DELETE restrict ON UPDATE no action;
