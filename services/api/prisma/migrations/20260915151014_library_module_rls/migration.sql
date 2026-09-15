ALTER TABLE "book_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "book_categories" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "book_categories"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "book_categories" TO app_runtime;

ALTER TABLE "books" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "books" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "books"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "books" TO app_runtime;

ALTER TABLE "library_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "library_transactions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "library_transactions"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "library_transactions" TO app_runtime;

ALTER TABLE "library_reservations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "library_reservations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "library_reservations"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "library_reservations" TO app_runtime;

ALTER TABLE "library_fines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "library_fines" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "library_fines"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "library_fines" TO app_runtime;

ALTER TABLE "library_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "library_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "library_settings"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "library_settings" TO app_runtime;
