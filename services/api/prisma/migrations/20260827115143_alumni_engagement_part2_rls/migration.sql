-- RLS for slice 8b's four new tables, same pattern as every prior RLS
-- migration: enforced against app_runtime (no BYPASSRLS), keyed on the
-- app.current_organization_id session GUC set by
-- PrismaService.withTenant().

ALTER TABLE "alumni_surveys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "alumni_surveys" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "alumni_surveys"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "alumni_surveys" TO app_runtime;

ALTER TABLE "alumni_survey_responses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "alumni_survey_responses" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "alumni_survey_responses"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "alumni_survey_responses" TO app_runtime;

ALTER TABLE "alumni_mentorship" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "alumni_mentorship" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "alumni_mentorship"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "alumni_mentorship" TO app_runtime;

ALTER TABLE "alumni_achievements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "alumni_achievements" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "alumni_achievements"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "alumni_achievements" TO app_runtime;
