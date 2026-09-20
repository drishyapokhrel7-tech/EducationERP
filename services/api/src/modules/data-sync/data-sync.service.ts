import { BadRequestException, Injectable } from "@nestjs/common";
import { StudentsService } from "../students/students.service";
import { StaffService } from "../staff/staff.service";
import { DisciplineService } from "../discipline/discipline.service";
import { HealthService } from "../health/health.service";
import { mergeWorkbooks, extractSheetBuffer } from "../../common/excel-sync";
import type { ImportResult } from "../students/dto/import-result.dto";

export interface CombinedImportResult {
  students?: ImportResult;
  employees?: ImportResult;
  activities?: ImportResult;
  disciplineIncidents?: ImportResult;
  healthVisits?: ImportResult;
}

// One workbook covering every entity that already has its own Excel
// round trip (StudentsService, StaffService, DisciplineService,
// HealthService), so an org can fill in — or edit-and-resync — several
// kinds of records from a single downloaded file instead of five
// separate ones. This module owns no columns or row-mapping of its
// own: it only stitches those entities' existing single-sheet
// workbooks together (mergeWorkbooks) and, on import, pulls each named
// sheet back out (extractSheetBuffer) to hand unchanged to that
// entity's own importX method — so a schema/validation change to any
// one entity's Excel format is picked up here automatically.
@Injectable()
export class DataSyncService {
  constructor(
    private readonly students: StudentsService,
    private readonly staff: StaffService,
    private readonly discipline: DisciplineService,
    private readonly health: HealthService,
  ) {}

  async generateCombinedTemplate(organizationId: string): Promise<Buffer> {
    const buffers = await Promise.all([
      this.students.generateImportTemplate(),
      this.staff.generateEmployeeImportTemplate(organizationId),
      this.students.generateActivityImportTemplate(organizationId),
      this.discipline.generateIncidentImportTemplate(organizationId),
      this.health.generateVisitImportTemplate(),
    ]);
    return mergeWorkbooks(buffers);
  }

  async exportCombinedEditable(organizationId: string): Promise<Buffer> {
    const buffers = await Promise.all([
      this.students.exportEditableStudents(organizationId),
      this.staff.exportEditableEmployees(organizationId),
      this.students.exportEditableActivities(organizationId),
      this.discipline.exportEditableIncidents(organizationId),
      this.health.exportEditableVisits(organizationId),
    ]);
    return mergeWorkbooks(buffers);
  }

  // Sheets are processed in a fixed, dependency-aware order — Students
  // (and Employees, independent of everyone) before Activities/
  // Incidents/Health Visits, which look their row's student up by
  // studentCode and must see any brand-new student the Students sheet
  // just created in this same import. Sequential awaits, not
  // Promise.all, so each sheet's writes are visible to the next.
  async importCombined(organizationId: string, userId: string, fileBuffer: Buffer, originalName: string): Promise<CombinedImportResult> {
    if (!/\.xlsx$/i.test(originalName)) {
      throw new BadRequestException("The combined data sync file must be an .xlsx workbook — a CSV can't carry multiple sheets");
    }

    const result: CombinedImportResult = {};

    // Each entity's importX runs in its own transaction (there's no
    // single transaction spanning all five sheets), so a sheet that
    // throws — a bug, a limit check, anything unexpected — must not
    // abort the request: earlier sheets have already committed, and
    // later ones are still independently worth attempting. runSheet
    // converts a thrown error into that sheet's own error entry instead
    // of letting it turn the whole response into a bare 500 that would
    // hide every already-committed sheet's real result.
    const runSheet = async (label: string, run: () => Promise<ImportResult>): Promise<ImportResult> => {
      try {
        return await run();
      } catch (err) {
        return { totalRows: 0, created: 0, updated: 0, errors: [{ row: 0, message: `${label} import failed: ${(err as Error).message}` }] };
      }
    };

    const studentsSheet = await extractSheetBuffer(fileBuffer, "Students");
    if (studentsSheet) {
      result.students = await runSheet("Students", () => this.students.importStudents(organizationId, studentsSheet, "students.xlsx"));
    }

    const employeesSheet = await extractSheetBuffer(fileBuffer, "Employees");
    if (employeesSheet) {
      result.employees = await runSheet("Employees", () => this.staff.importEmployees(organizationId, employeesSheet, "employees.xlsx"));
    }

    const activitiesSheet = await extractSheetBuffer(fileBuffer, "Activities");
    if (activitiesSheet) {
      result.activities = await runSheet("Activities", () =>
        this.students.importActivities(organizationId, activitiesSheet, "activities.xlsx"),
      );
    }

    const incidentsSheet = await extractSheetBuffer(fileBuffer, "Incidents");
    if (incidentsSheet) {
      result.disciplineIncidents = await runSheet("Incidents", () =>
        this.discipline.importIncidents(organizationId, userId, incidentsSheet, "incidents.xlsx"),
      );
    }

    const healthSheet = await extractSheetBuffer(fileBuffer, "Health Visits");
    if (healthSheet) {
      result.healthVisits = await runSheet("Health Visits", () =>
        this.health.importVisits(organizationId, userId, healthSheet, "health-visits.xlsx"),
      );
    }

    if (Object.keys(result).length === 0) {
      throw new BadRequestException(
        "No recognized sheets found — expected one or more of: Students, Employees, Activities, Incidents, Health Visits",
      );
    }

    return result;
  }
}
