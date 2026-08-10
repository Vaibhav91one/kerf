-- Clerk dashboard auth + Kerf CLI tokens.
--
-- `profiles.clerk_user_id` links a Kerf profile to a Clerk user after Google
-- sign-in. `profiles.token_hash` is nullable now: legacy/manual profiles still
-- have a one-time token hash, Clerk-created profiles mint separate rows in
-- `api_tokens` for non-interactive CLI usage.

ALTER TABLE "profiles" ADD COLUMN "clerk_user_id" TEXT;
ALTER TABLE "profiles" ALTER COLUMN "token_hash" DROP NOT NULL;

CREATE UNIQUE INDEX "profiles_clerk_user_id_key" ON "profiles"("clerk_user_id");

CREATE TABLE "api_tokens" (
  "id" TEXT NOT NULL,
  "handle" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "api_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "api_tokens_token_hash_key" ON "api_tokens"("token_hash");
CREATE INDEX "api_tokens_handle_idx" ON "api_tokens"("handle");

ALTER TABLE "api_tokens"
  ADD CONSTRAINT "api_tokens_handle_fkey"
  FOREIGN KEY ("handle") REFERENCES "profiles"("handle")
  ON DELETE CASCADE ON UPDATE CASCADE;
