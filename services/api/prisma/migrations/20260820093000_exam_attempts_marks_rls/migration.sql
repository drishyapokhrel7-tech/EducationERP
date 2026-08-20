-- RLS for the Phase 4 slice 4c exam-attempts/marks tables, same pattern
-- as every prior RLS migration: enforced against app_runtime (no
-- BYPASSRLS), keyed on the app.current_organization_id session GUC set
-- by PrismaService.withTenant().

ALTER TABLE "exam_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exam_attempts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "exam_attempts"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "marks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marks" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "marks"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON
  "exam_attempts", "marks"
  TO app_runtime;
