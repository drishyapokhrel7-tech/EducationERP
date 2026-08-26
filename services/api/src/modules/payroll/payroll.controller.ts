import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { PayrollStatus } from "@prisma/client";
import { PayrollService } from "./payroll.service";
import { CreateSalaryStructureDto } from "./dto/create-salary-structure.dto";
import { AddSalaryStructureItemDto } from "./dto/add-salary-structure-item.dto";
import { AssignSalaryStructureDto } from "./dto/assign-salary-structure.dto";
import { GeneratePayrollDto } from "./dto/generate-payroll.dto";
import { AddPayrollItemDto } from "./dto/add-payroll-item.dto";
import { MarkPayrollPaidDto } from "./dto/mark-payroll-paid.dto";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organizations/me")
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}

  @Post("salary-structures")
  @RequirePermissions("salary_structure:create")
  createSalaryStructure(@CurrentUser() user: JwtPayload, @Body() dto: CreateSalaryStructureDto) {
    return this.payroll.createSalaryStructure(user.organizationId, dto);
  }

  @Get("salary-structures")
  @RequirePermissions("salary_structure:view")
  listSalaryStructures(@CurrentUser() user: JwtPayload) {
    return this.payroll.listSalaryStructures(user.organizationId);
  }

  @Post("salary-structures/:id/items")
  @RequirePermissions("salary_structure:update")
  addSalaryStructureItem(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: AddSalaryStructureItemDto) {
    return this.payroll.addSalaryStructureItem(user.organizationId, id, dto);
  }

  @Delete("salary-structures/:id/items/:itemId")
  @RequirePermissions("salary_structure:update")
  removeSalaryStructureItem(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Param("itemId") itemId: string) {
    return this.payroll.removeSalaryStructureItem(user.organizationId, id, itemId);
  }

  @Post("employees/:id/salary-structure")
  @RequirePermissions("salary_structure:manage")
  assignSalaryStructure(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: AssignSalaryStructureDto) {
    return this.payroll.assignSalaryStructure(user.organizationId, id, dto.salaryStructureId);
  }

  @Delete("employees/:id/salary-structure")
  @RequirePermissions("salary_structure:manage")
  unassignSalaryStructure(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.payroll.unassignSalaryStructure(user.organizationId, id);
  }

  @Post("payroll/generate")
  @RequirePermissions("payroll:create")
  generatePayroll(@CurrentUser() user: JwtPayload, @Body() dto: GeneratePayrollDto) {
    return this.payroll.generatePayroll(user.organizationId, dto);
  }

  @Get("payroll")
  @RequirePermissions("payroll:view")
  listPayroll(
    @CurrentUser() user: JwtPayload,
    @Query("employeeId") employeeId?: string,
    @Query("periodMonth") periodMonth?: string,
    @Query("periodYear") periodYear?: string,
    @Query("status") status?: PayrollStatus,
  ) {
    return this.payroll.listPayroll(user.organizationId, {
      employeeId,
      periodMonth: periodMonth ? Number(periodMonth) : undefined,
      periodYear: periodYear ? Number(periodYear) : undefined,
      status,
    });
  }

  @Get("payroll/:id")
  @RequirePermissions("payroll:view")
  getPayroll(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.payroll.getPayroll(user.organizationId, id);
  }

  @Post("payroll/:id/items")
  @RequirePermissions("payroll:update")
  addPayrollItem(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: AddPayrollItemDto) {
    return this.payroll.addPayrollItem(user.organizationId, id, dto);
  }

  @Delete("payroll/:id/items/:itemId")
  @RequirePermissions("payroll:update")
  removePayrollItem(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Param("itemId") itemId: string) {
    return this.payroll.removePayrollItem(user.organizationId, id, itemId);
  }

  @Post("payroll/:id/finalize")
  @RequirePermissions("payroll:approve")
  finalizePayroll(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.payroll.finalizePayroll(user.organizationId, user.sub, id);
  }

  @Post("payroll/:id/pay")
  @RequirePermissions("payroll:manage")
  markPayrollPaid(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: MarkPayrollPaidDto) {
    return this.payroll.markPayrollPaid(user.organizationId, id, dto);
  }

  @Post("payroll/:id/cancel")
  @RequirePermissions("payroll:manage")
  cancelPayroll(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.payroll.cancelPayroll(user.organizationId, id);
  }
}
