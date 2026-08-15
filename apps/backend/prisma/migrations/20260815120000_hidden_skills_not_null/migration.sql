-- 20260811111434_add_visibility added "hidden_skills" without NOT NULL,
-- while schema.prisma declares it `String[] @default([])` (non-nullable) —
-- a latent mismatch between the generated client's types and what the
-- column actually allows. Backfill any NULL to the empty-array default
-- first (none expected outside a hand-edited row), then close the gap.
UPDATE "profiles" SET "hidden_skills" = ARRAY[]::TEXT[] WHERE "hidden_skills" IS NULL;

ALTER TABLE "profiles" ALTER COLUMN "hidden_skills" SET NOT NULL;
