-- Row-Level Security: second enforcement layer for tenant isolation,
-- on top of (never instead of) the organizationId scoping already done
-- in application code (see PrismaService.withTenant and every service
-- that takes organizationId from the caller's JWT).
--
-- Applied only to tables that are exclusively read/written through
-- PrismaService.withTenant(): campuses, audit_logs, access_policies.
-- users/roles/sessions/login_events are deliberately excluded here —
-- auth flows (login-by-email, org bootstrap, session issuance) run
-- before any tenant context exists and are inherently cross-tenant;
-- scoping those under RLS is a distinct design problem left for a
-- later phase, not silently worked around here.
--
-- This only provides real enforcement against a Postgres role WITHOUT
-- the BYPASSRLS attribute. The `app_runtime` role (see docs/PHASE_1_NOTES.md)
-- is what the API connects as at runtime; the DATABASE_URL owner
-- credential (has BYPASSRLS) is used for migrations only and must
-- never be used for the running API process.

ALTER TABLE "campuses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "campuses" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "campuses"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "audit_logs"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "access_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "access_policies" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "access_policies"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON "campuses", "audit_logs", "access_policies" TO app_runtime;
