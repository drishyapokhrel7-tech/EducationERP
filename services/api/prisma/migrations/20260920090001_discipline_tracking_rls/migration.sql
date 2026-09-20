-- RLS for discipline_incident_types and discipline_incidents, same
-- pattern as every prior RLS migration (see
-- 20260918151403_extracurricular_activities_rls): enforced against
-- app_runtime (no BYPASSRLS), keyed on the app.current_organization_id
-- session GUC set by PrismaService.withTenant().

ALTER TABLE "discipline_incident_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "discipline_incident_types" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "discipline_incident_types"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "discipline_incident_types" TO app_runtime;

ALTER TABLE "discipline_incidents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "discipline_incidents" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "discipline_incidents"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "discipline_incidents" TO app_runtime;
