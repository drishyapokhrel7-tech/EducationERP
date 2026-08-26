-- RLS for slice 7b-1's three new tables, same pattern as every prior
-- RLS migration: enforced against app_runtime (no BYPASSRLS), keyed on
-- the app.current_organization_id session GUC set by
-- PrismaService.withTenant().

ALTER TABLE "leave_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leave_types" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "leave_types"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "leave_types" TO app_runtime;

ALTER TABLE "staff_leave_balances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_leave_balances" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "staff_leave_balances"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "staff_leave_balances" TO app_runtime;

ALTER TABLE "leave_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leave_requests" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "leave_requests"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "leave_requests" TO app_runtime;
