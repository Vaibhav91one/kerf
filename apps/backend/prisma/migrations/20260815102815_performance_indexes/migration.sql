-- CreateIndex
CREATE INDEX "live_sessions_project_id_idx" ON "live_sessions"("project_id");

-- CreateIndex
CREATE INDEX "projects_is_public_created_at_idx" ON "projects"("is_public", "created_at");

-- CreateIndex
CREATE INDEX "session_metrics_handle_project_hash_idx" ON "session_metrics"("handle", "project_hash");

-- CreateIndex
CREATE INDEX "skill_stars_handle_idx" ON "skill_stars"("handle");

-- CreateIndex
CREATE INDEX "skills_library_is_public_created_at_idx" ON "skills_library"("is_public", "created_at");
