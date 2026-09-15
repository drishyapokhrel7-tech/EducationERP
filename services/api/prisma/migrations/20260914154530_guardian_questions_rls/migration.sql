-- RLS for guardian_questions, same pattern as every prior RLS migration
-- (see 20260905233200_term_exams_rls): enforced against app_runtime (no
-- BYPASSRLS), keyed on the app.current_organization_id session GUC set
-- by PrismaService.withTenant(). Guardian.userId needs no RLS change of
-- its own -- the existing guardians policy already covers the whole row.

ALTER TABLE "guardian_questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "guardian_questions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "guardian_questions"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "guardian_questions" TO app_runtime;
