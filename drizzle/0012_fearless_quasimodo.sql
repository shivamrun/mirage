CREATE TABLE "mirage_rate_limit" (
	"scope" text NOT NULL,
	"identifier_hash" text NOT NULL,
	"count" integer NOT NULL,
	"reset_at" timestamp with time zone NOT NULL,
	CONSTRAINT "mirage_rate_limit_scope_identifier_hash_pk" PRIMARY KEY("scope","identifier_hash")
);
