-- CreateTable
CREATE TABLE "session_metrics" (
    "session_id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'claude-code',
    "project_hash" TEXT NOT NULL,
    "started_ms" BIGINT NOT NULL,
    "ended_ms" BIGINT NOT NULL,
    "turns" INTEGER NOT NULL,
    "edits" INTEGER NOT NULL,
    "edits_rework" INTEGER NOT NULL,
    "rework_ratio" DOUBLE PRECISION,
    "qualifies" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_metrics_pkey" PRIMARY KEY ("session_id")
);

-- CreateIndex
CREATE INDEX "session_metrics_qualifies_started_ms_idx" ON "session_metrics"("qualifies", "started_ms");
