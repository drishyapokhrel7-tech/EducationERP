-- RLS for slice 6c's four new tables, same pattern as every prior RLS
-- migration: enforced against app_runtime (no BYPASSRLS), keyed on the
-- app.current_organization_id session GUC set by
-- PrismaService.withTenant().

ALTER TABLE "cameras" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cameras" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "cameras"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "cameras" TO app_runtime;

ALTER TABLE "camera_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "camera_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "camera_events"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "camera_events" TO app_runtime;

ALTER TABLE "face_embeddings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "face_embeddings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "face_embeddings"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "face_embeddings" TO app_runtime;

ALTER TABLE "face_match_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "face_match_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "face_match_events"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "face_match_events" TO app_runtime;
