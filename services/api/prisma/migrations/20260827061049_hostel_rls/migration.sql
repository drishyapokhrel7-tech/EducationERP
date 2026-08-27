-- RLS for slice 7e's nine new tables, same pattern as every prior RLS
-- migration: enforced against app_runtime (no BYPASSRLS), keyed on the
-- app.current_organization_id session GUC set by
-- PrismaService.withTenant().

ALTER TABLE "hostels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hostels" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "hostels"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "hostels" TO app_runtime;

ALTER TABLE "hostel_buildings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hostel_buildings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "hostel_buildings"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "hostel_buildings" TO app_runtime;

ALTER TABLE "hostel_rooms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hostel_rooms" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "hostel_rooms"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "hostel_rooms" TO app_runtime;

ALTER TABLE "hostel_beds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hostel_beds" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "hostel_beds"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "hostel_beds" TO app_runtime;

ALTER TABLE "hostel_allocations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hostel_allocations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "hostel_allocations"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "hostel_allocations" TO app_runtime;

ALTER TABLE "hostel_attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hostel_attendance" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "hostel_attendance"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "hostel_attendance" TO app_runtime;

ALTER TABLE "hostel_visitors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hostel_visitors" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "hostel_visitors"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "hostel_visitors" TO app_runtime;

ALTER TABLE "hostel_complaints" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hostel_complaints" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "hostel_complaints"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "hostel_complaints" TO app_runtime;

ALTER TABLE "hostel_maintenance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hostel_maintenance" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "hostel_maintenance"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "hostel_maintenance" TO app_runtime;
