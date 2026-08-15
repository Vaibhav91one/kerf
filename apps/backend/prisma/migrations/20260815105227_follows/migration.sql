-- CreateTable
CREATE TABLE "follows" (
    "follower_handle" TEXT NOT NULL,
    "followee_handle" TEXT NOT NULL,
    "is_rival" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("follower_handle","followee_handle")
);

-- CreateIndex
CREATE INDEX "follows_followee_handle_idx" ON "follows"("followee_handle");

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_handle_fkey" FOREIGN KEY ("follower_handle") REFERENCES "profiles"("handle") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_followee_handle_fkey" FOREIGN KEY ("followee_handle") REFERENCES "profiles"("handle") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-written: Prisma's schema language has no CHECK constraint syntax.
-- The route also 400s on self-follow (for the message); this is the actual
-- invariant.
ALTER TABLE "follows" ADD CONSTRAINT "follows_no_self" CHECK ("follower_handle" <> "followee_handle");
