-- RLS for the online-exam-taking slice's new "answers" table, same
-- pattern as every prior RLS migration: enforced against app_runtime
-- (no BYPASSRLS), keyed on the app.current_organization_id session GUC
-- set by PrismaService.withTenant(). exam_attempts and exam_subjects
-- already have RLS from slices 4c/4b — only "answers" is new here.

ALTER TABLE "answers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "answers" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "answers"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON "answers" TO app_runtime;
