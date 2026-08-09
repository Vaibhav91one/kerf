-- AlterTable
ALTER TABLE "session_metrics" ADD COLUMN     "tool_counts" JSONB NOT NULL DEFAULT '{}';
