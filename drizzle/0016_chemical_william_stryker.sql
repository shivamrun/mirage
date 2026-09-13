CREATE TABLE "adminSessionAssurance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"user_id" text NOT NULL,
	"method" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "adminSessionAssurance" ADD CONSTRAINT "adminSessionAssurance_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adminSessionAssurance" ADD CONSTRAINT "adminSessionAssurance_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "adminSessionAssurance_sessionId_idx" ON "adminSessionAssurance" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "adminSessionAssurance_userId_idx" ON "adminSessionAssurance" USING btree ("user_id");