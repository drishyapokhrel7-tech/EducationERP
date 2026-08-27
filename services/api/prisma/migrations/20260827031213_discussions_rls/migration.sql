-- RLS for slice 6's two new tables, same pattern as every prior RLS
-- migration: enforced against app_runtime (no BYPASSRLS), keyed on the
-- app.current_organization_id session GUC set by
-- PrismaService.withTenant().

ALTER TABLE "discussion_topics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "discussion_topics" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "discussion_topics"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "discussion_topics" TO app_runtime;

ALTER TABLE "discussion_posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "discussion_posts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "discussion_posts"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "discussion_posts" TO app_runtime;
