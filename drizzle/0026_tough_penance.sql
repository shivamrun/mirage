CREATE TABLE "mirage_invitation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"invited_by_user_id" text NOT NULL,
	"accepted_by_user_id" text,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mirage_invitation" ADD CONSTRAINT "mirage_invitation_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mirage_invitation" ADD CONSTRAINT "mirage_invitation_accepted_by_user_id_user_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mirage_invitation_email_idx" ON "mirage_invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "mirage_invitation_status_idx" ON "mirage_invitation" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mirage_invitation_expiresAt_idx" ON "mirage_invitation" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "mirage_invitation_tokenHash_idx" ON "mirage_invitation" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "mirage_invitation_invitedByUserId_idx" ON "mirage_invitation" USING btree ("invited_by_user_id");--> statement-breakpoint
CREATE INDEX "mirage_invitation_acceptedByUserId_idx" ON "mirage_invitation" USING btree ("accepted_by_user_id");