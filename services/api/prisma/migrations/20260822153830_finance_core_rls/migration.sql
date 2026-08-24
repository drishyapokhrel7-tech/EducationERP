-- RLS for slice 7a-1's twelve new Finance tables, same pattern as
-- every prior RLS migration: enforced against app_runtime (no
-- BYPASSRLS), keyed on the app.current_organization_id session GUC
-- set by PrismaService.withTenant().

ALTER TABLE "fee_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fee_categories" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "fee_categories"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "fee_categories" TO app_runtime;

ALTER TABLE "fee_structures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fee_structures" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "fee_structures"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "fee_structures" TO app_runtime;

ALTER TABLE "fee_structure_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fee_structure_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "fee_structure_items"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "fee_structure_items" TO app_runtime;

ALTER TABLE "student_fee_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_fee_assignments" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "student_fee_assignments"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "student_fee_assignments" TO app_runtime;

ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoices" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "invoices"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "invoices" TO app_runtime;

ALTER TABLE "invoice_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "invoice_items"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "invoice_items" TO app_runtime;

ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "payments"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "payments" TO app_runtime;

ALTER TABLE "scholarships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scholarships" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "scholarships"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "scholarships" TO app_runtime;

ALTER TABLE "student_scholarships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_scholarships" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "student_scholarships"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "student_scholarships" TO app_runtime;

ALTER TABLE "discounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "discounts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "discounts"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "discounts" TO app_runtime;

ALTER TABLE "refunds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "refunds" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "refunds"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "refunds" TO app_runtime;

ALTER TABLE "financial_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "financial_transactions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "financial_transactions"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "financial_transactions" TO app_runtime;
