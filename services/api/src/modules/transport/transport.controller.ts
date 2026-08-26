import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { TransportService } from "./transport.service";
import { CreateVehicleDto } from "./dto/create-vehicle.dto";
import { UpdateVehicleDto } from "./dto/update-vehicle.dto";
import { CreateDriverDto } from "./dto/create-driver.dto";
import { CreateRouteDto } from "./dto/create-route.dto";
import { UpdateRouteDto } from "./dto/update-route.dto";
import { AddStopDto } from "./dto/add-stop.dto";
import { AssignStudentTransportDto } from "./dto/assign-student-transport.dto";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organizations/me")
export class TransportController {
  constructor(private readonly transport: TransportService) {}

  @Post("vehicles")
  @RequirePermissions("vehicle:create")
  createVehicle(@CurrentUser() user: JwtPayload, @Body() dto: CreateVehicleDto) {
    return this.transport.createVehicle(user.organizationId, dto);
  }

  @Get("vehicles")
  @RequirePermissions("vehicle:view")
  listVehicles(@CurrentUser() user: JwtPayload) {
    return this.transport.listVehicles(user.organizationId);
  }

  @Patch("vehicles/:id")
  @RequirePermissions("vehicle:update")
  updateVehicle(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdateVehicleDto) {
    return this.transport.updateVehicle(user.organizationId, id, dto);
  }

  @Post("drivers")
  @RequirePermissions("route:create")
  createDriver(@CurrentUser() user: JwtPayload, @Body() dto: CreateDriverDto) {
    return this.transport.createDriver(user.organizationId, dto);
  }

  @Get("drivers")
  @RequirePermissions("route:view")
  listDrivers(@CurrentUser() user: JwtPayload) {
    return this.transport.listDrivers(user.organizationId);
  }

  @Post("routes")
  @RequirePermissions("route:create")
  createRoute(@CurrentUser() user: JwtPayload, @Body() dto: CreateRouteDto) {
    return this.transport.createRoute(user.organizationId, dto);
  }

  @Get("routes")
  @RequirePermissions("route:view")
  listRoutes(@CurrentUser() user: JwtPayload) {
    return this.transport.listRoutes(user.organizationId);
  }

  @Patch("routes/:id")
  @RequirePermissions("route:update")
  updateRoute(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdateRouteDto) {
    return this.transport.updateRoute(user.organizationId, id, dto);
  }

  @Post("routes/:id/stops")
  @RequirePermissions("route:update")
  addStop(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: AddStopDto) {
    return this.transport.addStop(user.organizationId, id, dto);
  }

  @Delete("routes/:id/stops/:stopId")
  @RequirePermissions("route:update")
  removeStop(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Param("stopId") stopId: string) {
    return this.transport.removeStop(user.organizationId, id, stopId);
  }

  @Post("student-transport-assignments")
  @RequirePermissions("route:manage")
  assignStudentTransport(@CurrentUser() user: JwtPayload, @Body() dto: AssignStudentTransportDto) {
    return this.transport.assignStudentTransport(user.organizationId, dto);
  }

  @Get("student-transport-assignments")
  @RequirePermissions("route:view")
  listStudentTransportAssignments(@CurrentUser() user: JwtPayload) {
    return this.transport.listStudentTransportAssignments(user.organizationId);
  }

  @Delete("student-transport-assignments/:studentEnrollmentId")
  @RequirePermissions("route:manage")
  unassignStudentTransport(@CurrentUser() user: JwtPayload, @Param("studentEnrollmentId") studentEnrollmentId: string) {
    return this.transport.unassignStudentTransport(user.organizationId, studentEnrollmentId);
  }

  @Get("vehicles/:id/tracking/latest")
  @RequirePermissions("route:view")
  getLatestTracking(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.transport.getLatestTracking(user.organizationId, id);
  }

  @Get("vehicles/tracking/latest")
  @RequirePermissions("route:view")
  listLatestTrackingByVehicle(@CurrentUser() user: JwtPayload) {
    return this.transport.listLatestTrackingByVehicle(user.organizationId);
  }
}
