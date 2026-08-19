-- RLS for the Syllabus tables, same pattern as every prior RLS
-- migration: enforced against app_runtime (no BYPASSRLS), keyed on the
-- app.current_organization_id session GUC set by
-- PrismaService.withTenant().

ALTER TABLE "syllabi" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "syllabi" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "syllabi"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "syllabus_nodes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "syllabus_nodes" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "syllabus_nodes"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "learning_objectives" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "learning_objectives" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "learning_objectives"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "lesson_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lesson_plans" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "lesson_plans"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON
  "syllabi", "syllabus_nodes", "learning_objectives", "lesson_plans"
  TO app_runtime;
