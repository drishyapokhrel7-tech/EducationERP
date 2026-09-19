-- RLS for substitute_assignments, same pattern as every prior RLS
-- migration (see 20260918151403_extracurricular_activities_rls):
-- enforced against app_runtime (no BYPASSRLS), keyed on the
-- app.current_organization_id session GUC set by PrismaService.withTenant().

ALTER TABLE "substitute_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "substitute_assignments" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "substitute_assignments"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "substitute_assignments" TO app_runtime;
