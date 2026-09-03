-- RLS for the Device Gateway's three new tables, same pattern as every
-- prior RLS migration: enforced against app_runtime (no BYPASSRLS),
-- keyed on the app.current_organization_id session GUC set by
-- PrismaService.withTenant().

ALTER TABLE "gateway_devices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "gateway_devices" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "gateway_devices"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "gateway_devices" TO app_runtime;

ALTER TABLE "gateway_card_bindings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "gateway_card_bindings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "gateway_card_bindings"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "gateway_card_bindings" TO app_runtime;

ALTER TABLE "gateway_scan_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "gateway_scan_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "gateway_scan_events"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "gateway_scan_events" TO app_runtime;
