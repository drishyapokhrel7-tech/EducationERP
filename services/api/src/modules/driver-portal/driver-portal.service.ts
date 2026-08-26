import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { SubmitTrackingDto } from "./dto/submit-tracking.dto";

/**
 * Self-service, not admin-facing — same shape as StudentPortalService:
 * the caller's own driver record is derived exclusively from their
 * linked Employee/Driver rows, never from a request param. A caller
 * can only ever read or write their own route's tracking data by
 * construction — see the plan (Phase 7 slice 7d-2) for why this is
 * gated with JwtAuthGuard only, no @RequirePermissions.
 */
@Injectable()
export class DriverPortalService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(organizationId: string, userId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const { employee, driver } = await this.getOwnDriver(tx, organizationId, userId);
      const route = await tx.route.findFirst({
        where: { organizationId, driverId: employee.id },
        include: { vehicle: true, stops: { orderBy: { sequence: "asc" } } },
      });
      return { driver, route };
    });
  }

  async submitTracking(organizationId: string, userId: string, dto: SubmitTrackingDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const { employee } = await this.getOwnDriver(tx, organizationId, userId);

      const route = await tx.route.findUnique({ where: { id: dto.routeId } });
      if (!route || route.organizationId !== organizationId || route.driverId !== employee.id) {
        throw new NotFoundException("Route not found");
      }
      if (!route.vehicleId) {
        throw new BadRequestException("This route has no vehicle assigned yet");
      }

      return tx.vehicleTrackingEvent.create({
        data: {
          organizationId,
          vehicleId: route.vehicleId,
          routeId: route.id,
          latitude: dto.latitude,
          longitude: dto.longitude,
        },
      });
    });
  }

  private async getOwnDriver(tx: PrismaClient, organizationId: string, userId: string) {
    const employee = await tx.employee.findUnique({ where: { userId } });
    if (!employee || employee.organizationId !== organizationId) {
      throw new NotFoundException("No employee record is linked to this account");
    }
    const driver = await tx.driver.findUnique({ where: { employeeId: employee.id }, include: { employee: true } });
    if (!driver) throw new NotFoundException("No driver record is linked to this account");
    return { employee, driver };
  }
}
