-- RLS for the Phase 4 slice 4a exam-structure tables, same pattern as
-- every prior RLS migration: enforced against app_runtime (no
-- BYPASSRLS), keyed on the app.current_organization_id session GUC set
-- by PrismaService.withTenant().

ALTER TABLE "exam_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exam_types" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "exam_types"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "grading_schemes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "grading_schemes" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "grading_schemes"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "question_banks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "question_banks" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "question_banks"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "questions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "questions"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON
  "exam_types", "grading_schemes", "question_banks", "questions"
  TO app_runtime;
