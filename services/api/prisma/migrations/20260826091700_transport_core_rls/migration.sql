-- RLS for slice 7d-1's five new tables, same pattern as every prior RLS
-- migration: enforced against app_runtime (no BYPASSRLS), keyed on the
-- app.current_organization_id session GUC set by
-- PrismaService.withTenant().

ALTER TABLE "vehicles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vehicles" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "vehicles"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "vehicles" TO app_runtime;

ALTER TABLE "drivers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "drivers" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "drivers"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "drivers" TO app_runtime;

ALTER TABLE "routes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "routes" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "routes"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "routes" TO app_runtime;

ALTER TABLE "stops" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stops" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "stops"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "stops" TO app_runtime;

ALTER TABLE "student_transport_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_transport_assignments" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "student_transport_assignments"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "student_transport_assignments" TO app_runtime;
