-- RLS for the Staff-group tables, same pattern as the previous two RLS
-- migrations: enforced against app_runtime (no BYPASSRLS), keyed on the
-- app.current_organization_id session GUC set by
-- PrismaService.withTenant(). All six are only ever touched through
-- service code that knows the tenant.

ALTER TABLE "staff_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_types" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "staff_types"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "designations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "designations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "designations"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employees" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "employees"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "employment_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employment_history" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "employment_history"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "qualifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "qualifications" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "qualifications"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "teacher_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teacher_profiles" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "teacher_profiles"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON
  "staff_types", "designations", "employees", "employment_history", "qualifications", "teacher_profiles"
  TO app_runtime;
