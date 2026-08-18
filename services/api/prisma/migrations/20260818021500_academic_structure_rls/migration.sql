-- RLS for the Academic-structure tables added in this migration series,
-- same pattern as every prior RLS migration: enforced against
-- app_runtime (no BYPASSRLS), keyed on the app.current_organization_id
-- session GUC set by PrismaService.withTenant().

ALTER TABLE "subjects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subjects" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "subjects"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "curricula" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "curricula" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "curricula"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "curriculum_subjects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "curriculum_subjects" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "curriculum_subjects"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON
  "subjects", "curricula", "curriculum_subjects"
  TO app_runtime;
