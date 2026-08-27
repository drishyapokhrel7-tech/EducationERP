-- RLS for slice 7f's seven new tables, same pattern as every prior RLS
-- migration: enforced against app_runtime (no BYPASSRLS), keyed on the
-- app.current_organization_id session GUC set by
-- PrismaService.withTenant().

ALTER TABLE "inventory_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_categories" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "inventory_categories"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "inventory_categories" TO app_runtime;

ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "suppliers" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "suppliers"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "suppliers" TO app_runtime;

ALTER TABLE "inventory_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "inventory_items"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "inventory_items" TO app_runtime;

ALTER TABLE "purchase_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "purchase_orders" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "purchase_orders"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "purchase_orders" TO app_runtime;

ALTER TABLE "purchase_order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "purchase_order_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "purchase_order_items"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "purchase_order_items" TO app_runtime;

ALTER TABLE "stock_movements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_movements" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "stock_movements"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "stock_movements" TO app_runtime;

ALTER TABLE "assets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assets" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "assets"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "assets" TO app_runtime;

ALTER TABLE "asset_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "asset_assignments" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "asset_assignments"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "asset_assignments" TO app_runtime;
