-- RLS for the hostel_lookups standardization catalog, same pattern as
-- every prior RLS migration: enforced against app_runtime (no
-- BYPASSRLS), keyed on the app.current_organization_id session GUC
-- set by PrismaService.withTenant().

ALTER TABLE "hostel_lookups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hostel_lookups" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "hostel_lookups"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "hostel_lookups" TO app_runtime;
