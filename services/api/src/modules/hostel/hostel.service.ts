import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateHostelDto } from "./dto/create-hostel.dto";
import { CreateBuildingDto } from "./dto/create-building.dto";
import { CreateRoomDto } from "./dto/create-room.dto";
import { CreateBedDto } from "./dto/create-bed.dto";
import { UpdateBedDto } from "./dto/update-bed.dto";
import { AllocateBedDto } from "./dto/allocate-bed.dto";
import { MarkAttendanceDto } from "./dto/mark-attendance.dto";
import { LogVisitorDto } from "./dto/log-visitor.dto";
import { CreateComplaintDto } from "./dto/create-complaint.dto";
import { UpdateComplaintDto } from "./dto/update-complaint.dto";
import { CreateMaintenanceRequestDto } from "./dto/create-maintenance-request.dto";
import { UpdateMaintenanceRequestDto } from "./dto/update-maintenance-request.dto";
import { CreateLookupDto } from "./dto/create-lookup.dto";
import { HostelLookupKind } from "@prisma/client";

const ALLOCATION_INCLUDE = {
  studentEnrollment: { include: { student: true } },
  bed: { include: { room: { include: { building: { include: { hostel: true } } } } } },
};

/**
 * Fees are deliberately out of scope here — a hostel allocation is
 * billed by creating a FeeStructure for the student's program+term
 * (Finance, already built) and assigning it via the existing
 * assign-fee-structure flow, same "same fee-routing story as 7c"
 * reuse already noted for Library fines. No hostel_payments table,
 * no new billing code.
 */
@Injectable()
export class HostelService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Hostels ───────────────────────────────────────────────────────

  createHostel(organizationId: string, dto: CreateHostelDto) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.hostel.create({ data: { organizationId, name: dto.name, code: dto.code, address: dto.address } }),
    );
  }

  listHostels(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.hostel.findMany({
        where: { organizationId },
        include: { buildings: { include: { rooms: { include: { beds: true } } } } },
        orderBy: { name: "asc" },
      }),
    );
  }

  // ── Buildings ─────────────────────────────────────────────────────

  async createBuilding(organizationId: string, dto: CreateBuildingDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadHostel(tx, organizationId, dto.hostelId);
      return tx.hostelBuilding.create({
        data: { organizationId, hostelId: dto.hostelId, name: dto.name, code: dto.code },
      });
    });
  }

  // ── Rooms ─────────────────────────────────────────────────────────

  async createRoom(organizationId: string, dto: CreateRoomDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadBuilding(tx, organizationId, dto.buildingId);
      return tx.hostelRoom.create({
        data: { organizationId, buildingId: dto.buildingId, roomNumber: dto.roomNumber, roomType: dto.roomType },
      });
    });
  }

  // ── Beds ──────────────────────────────────────────────────────────

  async createBed(organizationId: string, dto: CreateBedDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadRoom(tx, organizationId, dto.roomId);
      return tx.hostelBed.create({ data: { organizationId, roomId: dto.roomId, label: dto.label } });
    });
  }

  async updateBed(organizationId: string, bedId: string, dto: UpdateBedDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadBed(tx, organizationId, bedId);
      return tx.hostelBed.update({ where: { id: bedId }, data: { status: dto.status } });
    });
  }

  // Every currently-vacant bed, across the whole org — feeds the
  // allocation form's bed picker. "Vacant" is computed from the
  // absence of an allocation row, not a stored status (see the
  // HostelBedStatus enum's own comment in schema.prisma).
  listVacantBeds(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.hostelBed.findMany({
        where: { organizationId, status: "AVAILABLE", allocation: null },
        include: { room: { include: { building: { include: { hostel: true } } } } },
        orderBy: { label: "asc" },
      }),
    );
  }

  // ── Allocation ────────────────────────────────────────────────────

  async allocateBed(organizationId: string, dto: AllocateBedDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const enrollment = await tx.studentEnrollment.findUnique({ where: { id: dto.studentEnrollmentId } });
      if (!enrollment || enrollment.organizationId !== organizationId) throw new NotFoundException("Student enrollment not found");
      const bed = await this.loadBed(tx, organizationId, dto.bedId);
      if (bed.status === "MAINTENANCE") throw new ConflictException("This bed is under maintenance");

      const existingOnBed = await tx.hostelAllocation.findUnique({ where: { bedId: dto.bedId } });
      if (existingOnBed && existingOnBed.studentEnrollmentId !== dto.studentEnrollmentId) {
        throw new ConflictException("This bed is already occupied");
      }

      // Upsert, not reject-on-duplicate — moving a student to a
      // different bed is a legitimate admin action, not a conflict,
      // same "current pointer" precedent as StudentTransportAssignment.
      return tx.hostelAllocation.upsert({
        where: { studentEnrollmentId: dto.studentEnrollmentId },
        update: { bedId: dto.bedId },
        create: { organizationId, studentEnrollmentId: dto.studentEnrollmentId, bedId: dto.bedId },
        include: ALLOCATION_INCLUDE,
      });
    });
  }

  listAllocations(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.hostelAllocation.findMany({ where: { organizationId }, include: ALLOCATION_INCLUDE, orderBy: { allocatedAt: "desc" } }),
    );
  }

  async unallocateBed(organizationId: string, studentEnrollmentId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const existing = await tx.hostelAllocation.findUnique({ where: { studentEnrollmentId } });
      if (!existing || existing.organizationId !== organizationId) throw new NotFoundException("Hostel allocation not found");
      // Attendance/visitor/complaint rows only make sense in the context
      // of this specific stay (same "current pointer, no history" call
      // already made for the allocation itself) — clear them alongside
      // it rather than leaving orphaned rows the RESTRICT FKs would
      // otherwise block the delete on.
      await tx.hostelAttendance.deleteMany({ where: { hostelAllocationId: existing.id } });
      await tx.hostelVisitor.deleteMany({ where: { hostelAllocationId: existing.id } });
      await tx.hostelComplaint.deleteMany({ where: { hostelAllocationId: existing.id } });
      await tx.hostelAllocation.delete({ where: { studentEnrollmentId } });
      return { studentEnrollmentId };
    });
  }

  // ── Attendance ────────────────────────────────────────────────────

  async markAttendance(organizationId: string, allocationId: string, dto: MarkAttendanceDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadAllocation(tx, organizationId, allocationId);
      const date = new Date(dto.date);
      return tx.hostelAttendance.upsert({
        where: { hostelAllocationId_date: { hostelAllocationId: allocationId, date } },
        update: { status: dto.status },
        create: { organizationId, hostelAllocationId: allocationId, date, status: dto.status },
      });
    });
  }

  listAttendance(organizationId: string, allocationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.hostelAttendance.findMany({ where: { organizationId, hostelAllocationId: allocationId }, orderBy: { date: "desc" } }),
    );
  }

  // ── Visitors ──────────────────────────────────────────────────────

  async logVisitorIn(organizationId: string, allocationId: string, dto: LogVisitorDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadAllocation(tx, organizationId, allocationId);
      return tx.hostelVisitor.create({
        data: { organizationId, hostelAllocationId: allocationId, visitorName: dto.visitorName, relation: dto.relation },
      });
    });
  }

  async logVisitorOut(organizationId: string, visitorId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const visitor = await tx.hostelVisitor.findUnique({ where: { id: visitorId } });
      if (!visitor || visitor.organizationId !== organizationId) throw new NotFoundException("Visitor log not found");
      return tx.hostelVisitor.update({ where: { id: visitorId }, data: { checkOutAt: new Date() } });
    });
  }

  listVisitors(organizationId: string, allocationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.hostelVisitor.findMany({ where: { organizationId, hostelAllocationId: allocationId }, orderBy: { checkInAt: "desc" } }),
    );
  }

  // ── Complaints ────────────────────────────────────────────────────

  async createComplaint(organizationId: string, allocationId: string, dto: CreateComplaintDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadAllocation(tx, organizationId, allocationId);
      return tx.hostelComplaint.create({
        data: { organizationId, hostelAllocationId: allocationId, category: dto.category, description: dto.description },
      });
    });
  }

  async updateComplaint(organizationId: string, complaintId: string, dto: UpdateComplaintDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const complaint = await tx.hostelComplaint.findUnique({ where: { id: complaintId } });
      if (!complaint || complaint.organizationId !== organizationId) throw new NotFoundException("Complaint not found");
      return tx.hostelComplaint.update({
        where: { id: complaintId },
        data: {
          status: dto.status,
          resolutionNotes: dto.resolutionNotes,
          resolvedAt: dto.status === "RESOLVED" ? new Date() : complaint.resolvedAt,
        },
      });
    });
  }

  listComplaints(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.hostelComplaint.findMany({
        where: { organizationId },
        include: { hostelAllocation: { include: ALLOCATION_INCLUDE } },
        orderBy: { raisedAt: "desc" },
      }),
    );
  }

  // ── Maintenance ───────────────────────────────────────────────────

  async createMaintenanceRequest(organizationId: string, dto: CreateMaintenanceRequestDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadRoom(tx, organizationId, dto.roomId);
      return tx.hostelMaintenanceRequest.create({
        data: { organizationId, roomId: dto.roomId, description: dto.description },
      });
    });
  }

  async updateMaintenanceRequest(organizationId: string, requestId: string, dto: UpdateMaintenanceRequestDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const request = await tx.hostelMaintenanceRequest.findUnique({ where: { id: requestId } });
      if (!request || request.organizationId !== organizationId) throw new NotFoundException("Maintenance request not found");
      return tx.hostelMaintenanceRequest.update({
        where: { id: requestId },
        data: { status: dto.status, resolvedAt: dto.status === "RESOLVED" ? new Date() : request.resolvedAt },
      });
    });
  }

  listMaintenanceRequests(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.hostelMaintenanceRequest.findMany({
        where: { organizationId },
        include: { room: { include: { building: { include: { hostel: true } } } } },
        orderBy: { reportedAt: "desc" },
      }),
    );
  }

  // ── Standardization lookups (room type / visitor relation /
  // complaint category) ────────────────────────────────────────────

  // Upsert-by-name, not a plain create — re-adding an already-listed
  // value from the UI's "+ Add new" flow (e.g. two staff both typing
  // "Guardian" before a refresh) should return the existing row, not
  // 409 or duplicate it. The @@unique([organizationId, kind, name])
  // constraint is what makes this safe.
  createLookup(organizationId: string, dto: CreateLookupDto) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.hostelLookup.upsert({
        where: { organizationId_kind_name: { organizationId, kind: dto.kind, name: dto.name } },
        update: {},
        create: { organizationId, kind: dto.kind, name: dto.name },
      }),
    );
  }

  listLookups(organizationId: string, kind?: HostelLookupKind) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.hostelLookup.findMany({ where: { organizationId, kind }, orderBy: { name: "asc" } }),
    );
  }

  // ── FK-vs-RLS parent guards ──────────────────────────────────────

  private async loadHostel(tx: PrismaClient, organizationId: string, id: string) {
    const hostel = await tx.hostel.findUnique({ where: { id } });
    if (!hostel || hostel.organizationId !== organizationId) throw new NotFoundException("Hostel not found");
    return hostel;
  }

  private async loadBuilding(tx: PrismaClient, organizationId: string, id: string) {
    const building = await tx.hostelBuilding.findUnique({ where: { id } });
    if (!building || building.organizationId !== organizationId) throw new NotFoundException("Building not found");
    return building;
  }

  private async loadRoom(tx: PrismaClient, organizationId: string, id: string) {
    const room = await tx.hostelRoom.findUnique({ where: { id } });
    if (!room || room.organizationId !== organizationId) throw new NotFoundException("Room not found");
    return room;
  }

  private async loadBed(tx: PrismaClient, organizationId: string, id: string) {
    const bed = await tx.hostelBed.findUnique({ where: { id } });
    if (!bed || bed.organizationId !== organizationId) throw new NotFoundException("Bed not found");
    return bed;
  }

  private async loadAllocation(tx: PrismaClient, organizationId: string, id: string) {
    const allocation = await tx.hostelAllocation.findUnique({ where: { id } });
    if (!allocation || allocation.organizationId !== organizationId) throw new NotFoundException("Hostel allocation not found");
    return allocation;
  }
}
