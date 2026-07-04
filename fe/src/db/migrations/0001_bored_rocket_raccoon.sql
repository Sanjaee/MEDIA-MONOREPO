ALTER TABLE "sessions" ALTER COLUMN "expires" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "username" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "verification_tokens" ALTER COLUMN "expires" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "emailVerified" timestamp;