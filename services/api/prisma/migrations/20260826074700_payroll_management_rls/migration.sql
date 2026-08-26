-- RLS for slice 7b-2's four new tables, same pattern as every prior RLS
-- migration: enforced against app_runtime (no BYPASSRLS), keyed on the
-- app.current_organization_id session GUC set by
-- PrismaService.withTenant().

ALTER TABLE "salary_structures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "salary_structures" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "salary_structures"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "salary_structures" TO app_runtime;

ALTER TABLE "salary_structure_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "salary_structure_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "salary_structure_items"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "salary_structure_items" TO app_runtime;

ALTER TABLE "payroll" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payroll" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "payroll"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "payroll" TO app_runtime;

ALTER TABLE "payroll_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payroll_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "payroll_items"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "payroll_items" TO app_runtime;
