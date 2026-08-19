-- RLS for the Class Session tables, same pattern as every prior RLS
-- migration: enforced against app_runtime (no BYPASSRLS), keyed on the
-- app.current_organization_id session GUC set by
-- PrismaService.withTenant().

ALTER TABLE "class_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "class_sessions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "class_sessions"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "class_materials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "class_materials" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "class_materials"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON
  "class_sessions", "class_materials"
  TO app_runtime;
