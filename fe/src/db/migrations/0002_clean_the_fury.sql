ALTER TABLE "sessions" DROP CONSTRAINT "sessions_session_token_unique";--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "provider" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "provider_account_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_pkey";--> statement-breakpoint
ALTER TABLE "sessions" ADD PRIMARY KEY ("session_token");--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN "id";