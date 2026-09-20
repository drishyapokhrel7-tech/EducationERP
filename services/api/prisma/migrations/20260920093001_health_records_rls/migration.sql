-- RLS for student_health_profiles and health_visits, same pattern as
-- every prior RLS migration (see
-- 20260920090001_discipline_tracking_rls): enforced against
-- app_runtime (no BYPASSRLS), keyed on the app.current_organization_id
-- session GUC set by PrismaService.withTenant().

ALTER TABLE "student_health_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_health_profiles" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "student_health_profiles"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "student_health_profiles" TO app_runtime;

ALTER TABLE "health_visits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "health_visits" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "health_visits"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "health_visits" TO app_runtime;
