-- RLS for slice 7d-2's new table, same pattern as every prior RLS
-- migration: enforced against app_runtime (no BYPASSRLS), keyed on the
-- app.current_organization_id session GUC set by
-- PrismaService.withTenant().

ALTER TABLE "vehicle_tracking_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vehicle_tracking_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "vehicle_tracking_events"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "vehicle_tracking_events" TO app_runtime;
