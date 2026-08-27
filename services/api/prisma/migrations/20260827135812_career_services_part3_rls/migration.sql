-- RLS for slice 8c's four new tables, same pattern as every prior RLS
-- migration: enforced against app_runtime (no BYPASSRLS), keyed on the
-- app.current_organization_id session GUC set by
-- PrismaService.withTenant().

ALTER TABLE "career_opportunities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "career_opportunities" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "career_opportunities"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "career_opportunities" TO app_runtime;

ALTER TABLE "career_applications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "career_applications" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "career_applications"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "career_applications" TO app_runtime;

ALTER TABLE "career_services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "career_services" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "career_services"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "career_services" TO app_runtime;

ALTER TABLE "graduate_outcomes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "graduate_outcomes" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "graduate_outcomes"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "graduate_outcomes" TO app_runtime;
