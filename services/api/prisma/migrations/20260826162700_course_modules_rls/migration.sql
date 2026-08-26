-- RLS for slice 2's three new tables, same pattern as every prior RLS
-- migration: enforced against app_runtime (no BYPASSRLS), keyed on the
-- app.current_organization_id session GUC set by
-- PrismaService.withTenant().

ALTER TABLE "course_modules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "course_modules" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "course_modules"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "course_modules" TO app_runtime;

ALTER TABLE "course_module_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "course_module_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "course_module_items"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "course_module_items" TO app_runtime;

ALTER TABLE "course_module_item_completions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "course_module_item_completions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "course_module_item_completions"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "course_module_item_completions" TO app_runtime;
