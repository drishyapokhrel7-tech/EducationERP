import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { GatewayScanResult } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AttendanceReconciliationService } from "../attendance-reconciliation/attendance-reconciliation.service";
import { RegisterDeviceDto } from "./dto/register-device.dto";
import { ScanDto } from "./dto/scan.dto";
import { BindCardDto } from "./dto/bind-card.dto";

/**
 * Device Gateway (Phase 8, docx §12 "Biometric/Device Gateway") —
 * barcode/RFID/smart-card scan-in, printer, and a fingerprint-adapter
 * stub. Deliberately adapter-agnostic on the server side, same
 * reasoning as CameraEventsService.ingestEvent's own "simulated camera
 * source" comment: this endpoint doesn't know or care whether a scanned
 * code arrived from a real HID-wedge reader or a plain POST body — the
 * actual hardware-facing logic lives entirely in
 * apps/device-gateway-client, not here.
 */
@Injectable()
export class DeviceGatewayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceReconciliation: AttendanceReconciliationService,
  ) {}

  registerDevice(organizationId: string, dto: RegisterDeviceDto) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.gatewayDevice.create({
        data: { organizationId, name: dto.name, deviceType: dto.deviceType, location: dto.location },
      }),
    );
  }

  listDevices(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.gatewayDevice.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" } }),
    );
  }

  async scan(organizationId: string, deviceId: string, dto: ScanDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const device = await tx.gatewayDevice.findUnique({ where: { id: deviceId } });
      if (!device) throw new NotFoundException("Device not found");

      // Device health, same precedent as Camera.lastSeenAt — the
      // device reached the server, so it's alive, independent of
      // whether the scanned code actually resolved to anyone.
      await tx.gatewayDevice.update({ where: { id: deviceId }, data: { lastSeenAt: new Date() } });

      // Lookup order reflects the real hardware distinction this
      // plan's own investigation found: a card binding (for a
      // fixed-factory-UID RFID/smart-card) is tried first, and only
      // when nothing's bound does the raw code get tried as a literal
      // student/employee code (the simple case — a barcode printed
      // with an already-existing code, no binding step needed).
      const binding = await tx.gatewayCardBinding.findUnique({
        where: { organizationId_rawCode: { organizationId, rawCode: dto.rawCode } },
      });

      let matchedStudentId: string | null = null;
      let matchedEmployeeId: string | null = null;
      let matchedName: string | null = null;

      if (binding?.studentId) {
        const student = await tx.student.findUnique({ where: { id: binding.studentId } });
        if (student) {
          matchedStudentId = student.id;
          matchedName = `${student.firstName} ${student.lastName}`;
        }
      } else if (binding?.staffId) {
        const employee = await tx.employee.findUnique({ where: { id: binding.staffId } });
        if (employee) {
          matchedEmployeeId = employee.id;
          matchedName = `${employee.firstName} ${employee.lastName}`;
        }
      } else {
        const student = await tx.student.findFirst({
          where: { organizationId, studentCode: dto.rawCode, deletedAt: null },
        });
        if (student) {
          matchedStudentId = student.id;
          matchedName = `${student.firstName} ${student.lastName}`;
        } else {
          const employee = await tx.employee.findFirst({
            where: { organizationId, employeeCode: dto.rawCode, deletedAt: null },
          });
          if (employee) {
            matchedEmployeeId = employee.id;
            matchedName = `${employee.firstName} ${employee.lastName}`;
          }
        }
      }

      const result = matchedStudentId || matchedEmployeeId ? GatewayScanResult.IDENTIFIED : GatewayScanResult.NOT_FOUND;

      let event = await tx.gatewayScanEvent.create({
        data: {
          organizationId,
          deviceId,
          rawCode: dto.rawCode,
          matchedStudentId,
          matchedEmployeeId,
          result,
        },
      });

      let reconciled = false;
      if (result === GatewayScanResult.IDENTIFIED) {
        const reconciliation = await this.attendanceReconciliation.reconcile(
          tx,
          organizationId,
          event.createdAt,
          { studentId: matchedStudentId, staffId: matchedEmployeeId },
          "gateway scan",
        );
        if (reconciliation.studentAttendanceId || reconciliation.staffAttendanceId) {
          reconciled = true;
          event = await tx.gatewayScanEvent.update({
            where: { id: event.id },
            data: {
              reconciledStudentAttendanceId: reconciliation.studentAttendanceId,
              reconciledStaffAttendanceId: reconciliation.staffAttendanceId,
            },
          });
        }
      }

      return { result, matchedName, reconciled, event };
    });
  }

  async bindCard(organizationId: string, userId: string, dto: BindCardDto) {
    // Exactly one of studentId/staffId — same compact XOR check as
    // CreateFaceEnrollmentDto's own service-layer validation.
    if (!dto.studentId === !dto.staffId) {
      throw new BadRequestException("Provide exactly one of studentId or staffId");
    }
    return this.prisma.withTenant(organizationId, async (tx) => {
      if (dto.studentId) {
        const student = await tx.student.findUnique({ where: { id: dto.studentId } });
        if (!student) throw new NotFoundException("Student not found");
      }
      if (dto.staffId) {
        const employee = await tx.employee.findUnique({ where: { id: dto.staffId } });
        if (!employee) throw new NotFoundException("Employee not found");
      }
      return tx.gatewayCardBinding.upsert({
        where: { organizationId_rawCode: { organizationId, rawCode: dto.rawCode } },
        create: {
          organizationId,
          rawCode: dto.rawCode,
          studentId: dto.studentId,
          staffId: dto.staffId,
          boundBy: userId,
        },
        update: { studentId: dto.studentId, staffId: dto.staffId, boundBy: userId, boundAt: new Date() },
      });
    });
  }

  listScanEvents(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.gatewayScanEvent.findMany({
        where: { organizationId },
        include: { device: true, matchedStudent: true, matchedEmployee: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    );
  }
}
