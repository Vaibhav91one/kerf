/*
  Warnings:

  - The primary key for the `session_metrics` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Added the required column `handle` to the `session_metrics` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "session_metrics" DROP CONSTRAINT "session_metrics_pkey",
ADD COLUMN     "handle" TEXT NOT NULL,
ADD CONSTRAINT "session_metrics_pkey" PRIMARY KEY ("handle", "session_id");

-- CreateTable
CREATE TABLE "profiles" (
    "handle" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "bio" TEXT,
    "public_skills" BOOLEAN NOT NULL DEFAULT false,
    "token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("handle")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "repo_url" TEXT,
    "project_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_sessions" (
    "handle" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "project_id" TEXT,
    "started_ms" BIGINT NOT NULL,
    "last_beat_ms" BIGINT NOT NULL,
    "turns" INTEGER NOT NULL,
    "edits" INTEGER NOT NULL,
    "edits_rework" INTEGER NOT NULL,
    "rework_ratio" DOUBLE PRECISION,

    CONSTRAINT "live_sessions_pkey" PRIMARY KEY ("handle","session_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_token_hash_key" ON "profiles"("token_hash");

-- CreateIndex
CREATE INDEX "projects_handle_idx" ON "projects"("handle");

-- CreateIndex
CREATE INDEX "chat_messages_created_at_idx" ON "chat_messages"("created_at");

-- CreateIndex
CREATE INDEX "live_sessions_last_beat_ms_idx" ON "live_sessions"("last_beat_ms");

-- CreateIndex
CREATE INDEX "session_metrics_handle_started_ms_idx" ON "session_metrics"("handle", "started_ms");

-- AddForeignKey
ALTER TABLE "session_metrics" ADD CONSTRAINT "session_metrics_handle_fkey" FOREIGN KEY ("handle") REFERENCES "profiles"("handle") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_handle_fkey" FOREIGN KEY ("handle") REFERENCES "profiles"("handle") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_handle_fkey" FOREIGN KEY ("handle") REFERENCES "profiles"("handle") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_handle_fkey" FOREIGN KEY ("handle") REFERENCES "profiles"("handle") ON DELETE CASCADE ON UPDATE CASCADE;
