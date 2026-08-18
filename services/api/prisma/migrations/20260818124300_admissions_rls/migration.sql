-- RLS for the Admissions tables, same pattern as every prior RLS
-- migration: enforced against app_runtime (no BYPASSRLS), keyed on the
-- app.current_organization_id session GUC set by
-- PrismaService.withTenant().

ALTER TABLE "admission_applications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admission_applications" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "admission_applications"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "admission_status_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admission_status_history" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "admission_status_history"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON
  "admission_applications", "admission_status_history"
  TO app_runtime;
