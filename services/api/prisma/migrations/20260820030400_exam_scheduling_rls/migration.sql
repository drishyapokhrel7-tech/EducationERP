-- RLS for the Phase 4 slice 4b exam-scheduling tables, same pattern as
-- every prior RLS migration: enforced against app_runtime (no
-- BYPASSRLS), keyed on the app.current_organization_id session GUC set
-- by PrismaService.withTenant().

ALTER TABLE "exams" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exams" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "exams"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "exam_subjects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exam_subjects" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "exam_subjects"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "exam_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exam_schedules" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "exam_schedules"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "exam_rooms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exam_rooms" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "exam_rooms"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON
  "exams", "exam_subjects", "exam_schedules", "exam_rooms"
  TO app_runtime;
