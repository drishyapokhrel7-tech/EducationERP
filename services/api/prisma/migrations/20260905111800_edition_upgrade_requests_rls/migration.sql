-- RLS for edition_upgrade_requests, same pattern as every prior RLS
-- migration (see 20260904124100_edition_upgrade_payments_rls):
-- enforced against app_runtime (no BYPASSRLS), keyed on the
-- app.current_organization_id session GUC set by
-- PrismaService.withTenant().

ALTER TABLE "edition_upgrade_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "edition_upgrade_requests" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "edition_upgrade_requests"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "edition_upgrade_requests" TO app_runtime;
