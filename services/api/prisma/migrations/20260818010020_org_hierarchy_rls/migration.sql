-- RLS for the org-hierarchy tables added in this migration series, same
-- pattern as 20260817234200_row_level_security: enforced against
-- app_runtime (no BYPASSRLS), keyed on the app.current_organization_id
-- session GUC set by PrismaService.withTenant(). All six of these are
-- only ever touched through service code that knows the tenant (there's
-- no pre-tenant-context flow here the way auth/login has), so unlike
-- that migration there's no table to deliberately exclude.

ALTER TABLE "faculties" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "faculties" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "faculties"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "departments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "departments" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "departments"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "programs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "programs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "programs"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "academic_years" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "academic_years" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "academic_years"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "terms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "terms" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "terms"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "sections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sections" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "sections"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON
  "faculties", "departments", "programs", "academic_years", "terms", "sections"
  TO app_runtime;
