-- RLS for extracurricular_activity_lookups and extracurricular_activities,
-- same pattern as every prior RLS migration (see 20260914154530_guardian_questions_rls):
-- enforced against app_runtime (no BYPASSRLS), keyed on the
-- app.current_organization_id session GUC set by PrismaService.withTenant().

ALTER TABLE "extracurricular_activity_lookups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "extracurricular_activity_lookups" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "extracurricular_activity_lookups"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "extracurricular_activity_lookups" TO app_runtime;

ALTER TABLE "extracurricular_activities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "extracurricular_activities" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "extracurricular_activities"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "extracurricular_activities" TO app_runtime;
