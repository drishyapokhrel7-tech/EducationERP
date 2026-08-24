-- RLS for slice 7a-2's one new table, same pattern as every prior RLS
-- migration: enforced against app_runtime (no BYPASSRLS), keyed on the
-- app.current_organization_id session GUC set by
-- PrismaService.withTenant().

ALTER TABLE "esewa_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "esewa_transactions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "esewa_transactions"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "esewa_transactions" TO app_runtime;
