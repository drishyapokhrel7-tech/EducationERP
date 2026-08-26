-- RLS for slice 4's one new table, same pattern as every prior RLS
-- migration: enforced against app_runtime (no BYPASSRLS), keyed on the
-- app.current_organization_id session GUC set by
-- PrismaService.withTenant(). knowledge_check_attempts already has RLS
-- from its original migration; only knowledge_check_answers is new.

ALTER TABLE "knowledge_check_answers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "knowledge_check_answers" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "knowledge_check_answers"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "knowledge_check_answers" TO app_runtime;
