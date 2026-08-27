-- RLS for slice 7h's student_documents/staff_documents tables, same
-- pattern as every prior RLS migration: enforced against app_runtime
-- (no BYPASSRLS), keyed on the app.current_organization_id session
-- GUC set by PrismaService.withTenant().
--
-- "certificates" is DELIBERATELY EXCLUDED from RLS — same reasoning
-- already applied to users/roles/sessions since Phase 1: the public
-- certificate-verification endpoint has to look a row up with no
-- tenant context at all (a third party checking a certificate by its
-- verificationCode, not logged into anything), which an RLS policy
-- keyed on app.current_organization_id cannot do — no GUC set means
-- no rows visible, full stop. Every authenticated CertificatesService
-- query explicitly filters/checks organizationId in application code
-- instead, the same defense AuthService already relies on for User.

ALTER TABLE "student_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_documents" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "student_documents"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "student_documents" TO app_runtime;

ALTER TABLE "staff_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_documents" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "staff_documents"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "staff_documents" TO app_runtime;

-- certificates: no RLS, but app_runtime still needs plain grants to
-- read/write it at all (RLS and GRANT are orthogonal — this table is
-- just never filtered by tenant_isolation).
GRANT SELECT, INSERT, UPDATE, DELETE ON "certificates" TO app_runtime;
