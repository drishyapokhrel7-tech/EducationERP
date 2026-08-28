import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { FinanceService } from "./finance.service";
import { CreateFeeCategoryDto } from "./dto/create-fee-category.dto";
import { UpdateFeeCategoryDto } from "./dto/update-fee-category.dto";
import { CreateFeeStructureDto } from "./dto/create-fee-structure.dto";
import { AssignFeeStructureDto, AssignFeeStructureBulkDto } from "./dto/assign-fee-structure.dto";
import { RecordPaymentDto } from "./dto/record-payment.dto";
import { InitiateEsewaPaymentDto } from "./dto/initiate-esewa-payment.dto";
import { ConfirmEsewaPaymentDto } from "./dto/confirm-esewa-payment.dto";
import { ApplyDiscountDto } from "./dto/apply-discount.dto";
import { IssueRefundDto } from "./dto/issue-refund.dto";
import { CreateScholarshipDto } from "./dto/create-scholarship.dto";
import { UpdateScholarshipDto } from "./dto/update-scholarship.dto";
import { AssignScholarshipDto } from "./dto/assign-scholarship.dto";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";
import { PaginationQueryDto } from "../../common/dto/pagination.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organizations/me")
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Post("fee-categories")
  @RequirePermissions("fee_category:create")
  createFeeCategory(@CurrentUser() user: JwtPayload, @Body() dto: CreateFeeCategoryDto) {
    return this.finance.createFeeCategory(user.organizationId, dto);
  }

  @Get("fee-categories")
  @RequirePermissions("fee_category:view")
  listFeeCategories(@CurrentUser() user: JwtPayload) {
    return this.finance.listFeeCategories(user.organizationId);
  }

  @Patch("fee-categories/:id")
  @RequirePermissions("fee_category:update")
  updateFeeCategory(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdateFeeCategoryDto) {
    return this.finance.updateFeeCategory(user.organizationId, id, dto);
  }

  @Delete("fee-categories/:id")
  @RequirePermissions("fee_category:delete")
  deleteFeeCategory(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.finance.deleteFeeCategory(user.organizationId, id);
  }

  @Post("fee-structures")
  @RequirePermissions("fee_structure:create")
  createFeeStructure(@CurrentUser() user: JwtPayload, @Body() dto: CreateFeeStructureDto) {
    return this.finance.createFeeStructure(user.organizationId, dto);
  }

  @Get("fee-structures")
  @RequirePermissions("fee_structure:view")
  listFeeStructures(@CurrentUser() user: JwtPayload) {
    return this.finance.listFeeStructures(user.organizationId);
  }

  @Post("fee-structures/:id/assign")
  @RequirePermissions("student_fee_assignment:create")
  assignFeeStructure(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: AssignFeeStructureDto,
  ) {
    return this.finance.assignFeeStructure(user.organizationId, id, user.sub, dto);
  }

  @Post("fee-structures/:id/assign-bulk")
  @RequirePermissions("student_fee_assignment:create")
  assignFeeStructureBulk(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: AssignFeeStructureBulkDto,
  ) {
    return this.finance.assignFeeStructureBulk(user.organizationId, id, user.sub, dto);
  }

  @Get("invoices")
  @RequirePermissions("invoice:view")
  listInvoices(@CurrentUser() user: JwtPayload, @Query() pagination: PaginationQueryDto) {
    return this.finance.listInvoices(user.organizationId, pagination.page ?? 1, pagination.pageSize ?? 25);
  }

  @Get("invoices/:id")
  @RequirePermissions("invoice:view")
  getInvoice(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.finance.getInvoice(user.organizationId, id);
  }

  @Post("invoices/:id/payments")
  @RequirePermissions("payment:create")
  recordPayment(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: RecordPaymentDto) {
    return this.finance.recordPayment(user.organizationId, id, user.sub, dto);
  }

  // eSewa online payment (slice 7a-2) — same payment:create permission
  // as manual payment recording, since a gateway-confirmed payment is
  // still fundamentally "this invoice got paid."
  @Post("invoices/:id/esewa/initiate")
  @RequirePermissions("payment:create")
  initiateEsewaPayment(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: InitiateEsewaPaymentDto) {
    return this.finance.initiateEsewaPayment(user.organizationId, id, dto.amount, user.sub, "admin");
  }

  @Post("esewa/verify")
  @RequirePermissions("payment:create")
  confirmEsewaPayment(@CurrentUser() user: JwtPayload, @Body() dto: ConfirmEsewaPaymentDto) {
    return this.finance.confirmEsewaPayment(user.organizationId, dto.data);
  }

  @Post("invoices/:id/discounts")
  @RequirePermissions("discount:create")
  applyDiscount(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: ApplyDiscountDto) {
    return this.finance.applyDiscount(user.organizationId, id, user.sub, dto);
  }

  @Post("payments/:id/refunds")
  @RequirePermissions("refund:create")
  issueRefund(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: IssueRefundDto) {
    return this.finance.issueRefund(user.organizationId, id, user.sub, dto);
  }

  // Folded under invoice:view rather than a new RBAC resource — the
  // ledger is a cross-cutting audit trail over Invoice/Payment/
  // Discount/Refund, not its own owned entity, matching how e.g.
  // curriculum_subjects folds into the curriculum resource.
  @Get("financial-transactions")
  @RequirePermissions("invoice:view")
  listFinancialTransactions(@CurrentUser() user: JwtPayload) {
    return this.finance.listFinancialTransactions(user.organizationId);
  }

  @Post("scholarships")
  @RequirePermissions("scholarship:create")
  createScholarship(@CurrentUser() user: JwtPayload, @Body() dto: CreateScholarshipDto) {
    return this.finance.createScholarship(user.organizationId, dto);
  }

  @Get("scholarships")
  @RequirePermissions("scholarship:view")
  listScholarships(@CurrentUser() user: JwtPayload) {
    return this.finance.listScholarships(user.organizationId);
  }

  @Patch("scholarships/:id")
  @RequirePermissions("scholarship:update")
  updateScholarship(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdateScholarshipDto) {
    return this.finance.updateScholarship(user.organizationId, id, dto);
  }

  @Delete("scholarships/:id")
  @RequirePermissions("scholarship:delete")
  deleteScholarship(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.finance.deleteScholarship(user.organizationId, id);
  }

  @Post("students/:id/scholarships")
  @RequirePermissions("scholarship:manage")
  assignScholarship(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: AssignScholarshipDto) {
    return this.finance.assignScholarship(user.organizationId, id, dto);
  }
}
