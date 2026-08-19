-- RLS for the Assignments/Knowledge-Checks tables, same pattern as
-- every prior RLS migration: enforced against app_runtime (no
-- BYPASSRLS), keyed on the app.current_organization_id session GUC set
-- by PrismaService.withTenant().

ALTER TABLE "assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assignments" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "assignments"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "assignment_submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assignment_submissions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "assignment_submissions"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "knowledge_checks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "knowledge_checks" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "knowledge_checks"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "knowledge_check_questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "knowledge_check_questions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "knowledge_check_questions"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "knowledge_check_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "knowledge_check_attempts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "knowledge_check_attempts"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON
  "assignments", "assignment_submissions", "knowledge_checks",
  "knowledge_check_questions", "knowledge_check_attempts"
  TO app_runtime;
