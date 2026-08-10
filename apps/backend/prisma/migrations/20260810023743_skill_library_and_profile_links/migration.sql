-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "avatar_url" TEXT,
ADD COLUMN     "github_url" TEXT,
ADD COLUMN     "website_url" TEXT,
ADD COLUMN     "x_url" TEXT;

-- CreateTable
CREATE TABLE "skills_library" (
    "id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "install_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skills_library_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_stars" (
    "skill_id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,

    CONSTRAINT "skill_stars_pkey" PRIMARY KEY ("skill_id","handle")
);

-- CreateIndex
CREATE UNIQUE INDEX "skills_library_slug_key" ON "skills_library"("slug");

-- CreateIndex
CREATE INDEX "skills_library_handle_idx" ON "skills_library"("handle");

-- AddForeignKey
ALTER TABLE "skills_library" ADD CONSTRAINT "skills_library_handle_fkey" FOREIGN KEY ("handle") REFERENCES "profiles"("handle") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_stars" ADD CONSTRAINT "skill_stars_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills_library"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_stars" ADD CONSTRAINT "skill_stars_handle_fkey" FOREIGN KEY ("handle") REFERENCES "profiles"("handle") ON DELETE CASCADE ON UPDATE CASCADE;
