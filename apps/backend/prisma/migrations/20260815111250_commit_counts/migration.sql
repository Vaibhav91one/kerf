-- CreateTable
CREATE TABLE "commit_counts" (
    "handle" TEXT NOT NULL,
    "month_start_ms" BIGINT NOT NULL,
    "commits" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commit_counts_pkey" PRIMARY KEY ("handle","month_start_ms")
);

-- CreateIndex
CREATE INDEX "commit_counts_month_start_ms_idx" ON "commit_counts"("month_start_ms");

-- AddForeignKey
ALTER TABLE "commit_counts" ADD CONSTRAINT "commit_counts_handle_fkey" FOREIGN KEY ("handle") REFERENCES "profiles"("handle") ON DELETE CASCADE ON UPDATE CASCADE;
