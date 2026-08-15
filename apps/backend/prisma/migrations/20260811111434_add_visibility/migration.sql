-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "hidden_skills" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "is_public" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "skills_library" ADD COLUMN     "is_public" BOOLEAN NOT NULL DEFAULT true;
