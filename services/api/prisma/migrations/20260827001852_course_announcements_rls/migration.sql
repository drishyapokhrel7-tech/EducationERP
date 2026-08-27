-- RLS for slice 5's one new table, same pattern as every prior RLS
-- migration: enforced against app_runtime (no BYPASSRLS), keyed on the
-- app.current_organization_id session GUC set by
-- PrismaService.withTenant().

ALTER TABLE "announcements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "announcements" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "announcements"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "announcements" TO app_runtime;
