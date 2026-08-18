-- RLS for the Timetable tables, same pattern as every prior RLS
-- migration: enforced against app_runtime (no BYPASSRLS), keyed on the
-- app.current_organization_id session GUC set by
-- PrismaService.withTenant().

ALTER TABLE "rooms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rooms" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "rooms"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "periods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "periods" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "periods"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "teaching_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teaching_assignments" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "teaching_assignments"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "class_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "class_schedules" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "class_schedules"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON
  "rooms", "periods", "teaching_assignments", "class_schedules"
  TO app_runtime;
