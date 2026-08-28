import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateVehicleDto } from "./dto/create-vehicle.dto";
import { UpdateVehicleDto } from "./dto/update-vehicle.dto";
import { CreateDriverDto } from "./dto/create-driver.dto";
import { UpdateDriverDto } from "./dto/update-driver.dto";
import { CreateRouteDto } from "./dto/create-route.dto";
import { UpdateRouteDto } from "./dto/update-route.dto";
import { AddStopDto } from "./dto/add-stop.dto";
import { AssignStudentTransportDto } from "./dto/assign-student-transport.dto";
import { assertNoDependents } from "../../common/assert-no-dependents";

@Injectable()
export class TransportService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Vehicles ──────────────────────────────────────────────────────

  createVehicle(organizationId: string, dto: CreateVehicleDto) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.vehicle.create({
        data: { organizationId, registrationNumber: dto.registrationNumber, type: dto.type, capacity: dto.capacity, status: dto.status },
      }),
    );
  }

  listVehicles(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.vehicle.findMany({ where: { organizationId }, orderBy: { registrationNumber: "asc" } }),
    );
  }

  async updateVehicle(organizationId: string, id: string, dto: UpdateVehicleDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadVehicle(tx, organizationId, id);
      return tx.vehicle.update({ where: { id }, data: dto });
    });
  }

  private async loadVehicle(tx: PrismaClient, organizationId: string, id: string) {
    const vehicle = await tx.vehicle.findUnique({ where: { id } });
    if (!vehicle || vehicle.organizationId !== organizationId) throw new NotFoundException("Vehicle not found");
    return vehicle;
  }

  // ── Live tracking (Phase 7 slice 7d-2) ───────────────────────────────

  async getLatestTracking(organizationId: string, vehicleId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadVehicle(tx, organizationId, vehicleId);
      return tx.vehicleTrackingEvent.findFirst({
        where: { organizationId, vehicleId },
        orderBy: { recordedAt: "desc" },
      });
    });
  }

  // One row per vehicle, its most recent ping — feeds the admin
  // Live Tracking map. `distinct` after `orderBy: recordedAt desc`
  // keeps only the first (i.e. latest) row per vehicleId.
  listLatestTrackingByVehicle(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.vehicleTrackingEvent.findMany({
        where: { organizationId },
        distinct: ["vehicleId"],
        orderBy: { recordedAt: "desc" },
        include: { vehicle: true },
      }),
    );
  }

  // ── Drivers ───────────────────────────────────────────────────────

  async createDriver(organizationId: string, dto: CreateDriverDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const employee = await tx.employee.findUnique({ where: { id: dto.employeeId } });
      if (!employee || employee.organizationId !== organizationId) throw new NotFoundException("Employee not found");

      const existing = await tx.driver.findUnique({ where: { employeeId: dto.employeeId } });
      if (existing) throw new ConflictException("This employee already has a driver profile");

      return tx.driver.create({
        data: { organizationId, employeeId: dto.employeeId, licenseNumber: dto.licenseNumber, licenseExpiry: new Date(dto.licenseExpiry) },
        include: { employee: true },
      });
    });
  }

  listDrivers(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.driver.findMany({
        where: { organizationId },
        include: { employee: true },
        orderBy: [{ employee: { firstName: "asc" } }, { employee: { lastName: "asc" } }],
      }),
    );
  }

  async updateDriver(organizationId: string, id: string, dto: UpdateDriverDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadDriver(tx, organizationId, id);
      if (dto.employeeId) {
        const employee = await tx.employee.findUnique({ where: { id: dto.employeeId } });
        if (!employee || employee.organizationId !== organizationId) throw new NotFoundException("Employee not found");
        const existing = await tx.driver.findUnique({ where: { employeeId: dto.employeeId } });
        if (existing && existing.id !== id) throw new ConflictException("This employee already has a driver profile");
      }
      return tx.driver.update({
        where: { id },
        data: {
          employeeId: dto.employeeId,
          licenseNumber: dto.licenseNumber,
          licenseExpiry: dto.licenseExpiry ? new Date(dto.licenseExpiry) : undefined,
        },
        include: { employee: true },
      });
    });
  }

  // Note: Route.driverId stores the driver's Employee.id, not the
  // Driver row's own id (see assertIsDriver — a route's "driver" is
  // resolved by employeeId, not by Driver.id). So the dependency count
  // here is keyed off the loaded driver's employeeId, not the :id path
  // param itself.
  async deleteDriver(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const driver = await this.loadDriver(tx, organizationId, id);
      await assertNoDependents([tx.route.count({ where: { driverId: driver.employeeId } })], "driver");
      await tx.driver.delete({ where: { id } });
      return { deleted: true };
    });
  }

  private async loadDriver(tx: PrismaClient, organizationId: string, id: string) {
    const driver = await tx.driver.findUnique({ where: { id } });
    if (!driver || driver.organizationId !== organizationId) throw new NotFoundException("Driver not found");
    return driver;
  }

  // ── Routes ────────────────────────────────────────────────────────

  async createRoute(organizationId: string, dto: CreateRouteDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      if (dto.vehicleId) await this.loadVehicle(tx, organizationId, dto.vehicleId);
      if (dto.driverId) await this.assertIsDriver(tx, organizationId, dto.driverId);

      return tx.route.create({
        data: { organizationId, name: dto.name, code: dto.code, vehicleId: dto.vehicleId, driverId: dto.driverId },
        include: { vehicle: true, driver: true, stops: true },
      });
    });
  }

  listRoutes(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.route.findMany({
        where: { organizationId },
        include: { vehicle: true, driver: true, stops: { orderBy: { sequence: "asc" } } },
        orderBy: { name: "asc" },
      }),
    );
  }

  async updateRoute(organizationId: string, id: string, dto: UpdateRouteDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadRoute(tx, organizationId, id);
      if (dto.vehicleId) await this.loadVehicle(tx, organizationId, dto.vehicleId);
      if (dto.driverId) await this.assertIsDriver(tx, organizationId, dto.driverId);

      return tx.route.update({
        where: { id },
        data: { name: dto.name, code: dto.code, vehicleId: dto.vehicleId, driverId: dto.driverId },
        include: { vehicle: true, driver: true, stops: { orderBy: { sequence: "asc" } } },
      });
    });
  }

  async addStop(organizationId: string, routeId: string, dto: AddStopDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadRoute(tx, organizationId, routeId);
      const existing = await tx.stop.findUnique({ where: { routeId_sequence: { routeId, sequence: dto.sequence } } });
      if (existing) throw new ConflictException(`This route already has a stop at sequence ${dto.sequence}`);

      return tx.stop.create({
        data: {
          organizationId,
          routeId,
          name: dto.name,
          sequence: dto.sequence,
          arrivalOffsetMinutes: dto.arrivalOffsetMinutes,
          latitude: dto.latitude,
          longitude: dto.longitude,
        },
      });
    });
  }

  async removeStop(organizationId: string, routeId: string, stopId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadRoute(tx, organizationId, routeId);
      const stop = await tx.stop.findUnique({ where: { id: stopId } });
      if (!stop || stop.routeId !== routeId) throw new NotFoundException("Stop not found");
      await tx.stop.delete({ where: { id: stopId } });
      return { id: stopId };
    });
  }

  private async loadRoute(tx: PrismaClient, organizationId: string, id: string) {
    const route = await tx.route.findUnique({ where: { id } });
    if (!route || route.organizationId !== organizationId) throw new NotFoundException("Route not found");
    return route;
  }

  private async assertIsDriver(tx: PrismaClient, organizationId: string, employeeId: string) {
    const employee = await tx.employee.findUnique({ where: { id: employeeId } });
    if (!employee || employee.organizationId !== organizationId) throw new NotFoundException("Employee not found");
    const driver = await tx.driver.findUnique({ where: { employeeId } });
    if (!driver) throw new BadRequestException("This employee does not have a driver profile");
  }

  // ── Student assignment ───────────────────────────────────────────────

  async assignStudentTransport(organizationId: string, dto: AssignStudentTransportDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const enrollment = await tx.studentEnrollment.findUnique({ where: { id: dto.studentEnrollmentId } });
      if (!enrollment || enrollment.organizationId !== organizationId) throw new NotFoundException("Student enrollment not found");
      const route = await this.loadRoute(tx, organizationId, dto.routeId);
      const stop = await tx.stop.findUnique({ where: { id: dto.stopId } });
      if (!stop || stop.organizationId !== organizationId || stop.routeId !== route.id) {
        throw new NotFoundException("Stop not found on this route");
      }

      // Upsert, not reject-on-duplicate — reassigning a student to a
      // different route/stop is a legitimate admin action, not a
      // conflict, same "current pointer" precedent as
      // Employee.salaryStructureId.
      return tx.studentTransportAssignment.upsert({
        where: { studentEnrollmentId: dto.studentEnrollmentId },
        update: { routeId: dto.routeId, stopId: dto.stopId },
        create: { organizationId, studentEnrollmentId: dto.studentEnrollmentId, routeId: dto.routeId, stopId: dto.stopId },
        include: { studentEnrollment: { include: { student: true } }, route: { include: { vehicle: true, driver: true, stops: true } }, stop: true },
      });
    });
  }

  listStudentTransportAssignments(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.studentTransportAssignment.findMany({
        where: { organizationId },
        include: {
          studentEnrollment: { include: { student: true } },
          route: { include: { vehicle: true, driver: true, stops: true } },
          stop: true,
        },
        orderBy: { assignedAt: "desc" },
      }),
    );
  }

  async unassignStudentTransport(organizationId: string, studentEnrollmentId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const existing = await tx.studentTransportAssignment.findUnique({ where: { studentEnrollmentId } });
      if (!existing || existing.organizationId !== organizationId) throw new NotFoundException("Transport assignment not found");
      await tx.studentTransportAssignment.delete({ where: { studentEnrollmentId } });
      return { studentEnrollmentId };
    });
  }
}
