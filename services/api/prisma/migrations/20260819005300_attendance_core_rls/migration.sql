-- RLS for the Attendance tables, same pattern as every prior RLS
-- migration: enforced against app_runtime (no BYPASSRLS), keyed on the
-- app.current_organization_id session GUC set by
-- PrismaService.withTenant().

ALTER TABLE "attendance_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_sessions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "attendance_sessions"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "student_attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_attendance" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "student_attendance"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "attendance_exceptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_exceptions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "attendance_exceptions"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "staff_attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_attendance" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "staff_attendance"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON
  "attendance_sessions", "student_attendance", "attendance_exceptions", "staff_attendance"
  TO app_runtime;
