-- RLS for term_exams, same pattern as every prior RLS migration (see
-- 20260905111800_edition_upgrade_requests_rls): enforced against
-- app_runtime (no BYPASSRLS), keyed on the app.current_organization_id
-- session GUC set by PrismaService.withTenant().

ALTER TABLE "term_exams" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "term_exams" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "term_exams"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "term_exams" TO app_runtime;
