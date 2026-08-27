-- RLS for slice 8a's six new tables, same pattern as every prior RLS
-- migration: enforced against app_runtime (no BYPASSRLS), keyed on the
-- app.current_organization_id session GUC set by
-- PrismaService.withTenant().

ALTER TABLE "alumni_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "alumni_profiles" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "alumni_profiles"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "alumni_profiles" TO app_runtime;

ALTER TABLE "alumni_education" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "alumni_education" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "alumni_education"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "alumni_education" TO app_runtime;

ALTER TABLE "alumni_companies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "alumni_companies" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "alumni_companies"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "alumni_companies" TO app_runtime;

ALTER TABLE "alumni_career_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "alumni_career_history" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "alumni_career_history"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "alumni_career_history" TO app_runtime;

ALTER TABLE "alumni_skills" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "alumni_skills" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "alumni_skills"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "alumni_skills" TO app_runtime;

ALTER TABLE "alumni_certifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "alumni_certifications" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "alumni_certifications"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "alumni_certifications" TO app_runtime;
