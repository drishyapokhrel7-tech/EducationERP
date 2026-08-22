-- RLS for slice 6a's two new tables, same pattern as every prior RLS
-- migration: enforced against app_runtime (no BYPASSRLS), keyed on the
-- app.current_organization_id session GUC set by
-- PrismaService.withTenant().

ALTER TABLE "biometric_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "biometric_policies" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "biometric_policies"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON "biometric_policies" TO app_runtime;

ALTER TABLE "face_enrollments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "face_enrollments" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "face_enrollments"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON "face_enrollments" TO app_runtime;
