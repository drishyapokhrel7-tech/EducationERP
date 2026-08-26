import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { StudentPortalService } from "./student-portal.service";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";
import { InitiateEsewaPaymentDto } from "../finance/dto/initiate-esewa-payment.dto";
import { ConfirmEsewaPaymentDto } from "../finance/dto/confirm-esewa-payment.dto";
import { SubmitAssignmentDto } from "./dto/submit-assignment.dto";

// Deliberately JwtAuthGuard only — no PermissionsGuard/@RequirePermissions.
// The existing resource:action permission model answers "can this role
// act on any row of this resource," which doesn't fit "can this specific
// student see their own data and nothing else." Authorization here comes
// entirely from studentId being derived server-side from the caller's own
// linked Student row (see StudentPortalService) — there's no permission
// string that would make that check more or less correct.
@UseGuards(JwtAuthGuard)
@Controller("organizations/me/portal")
export class StudentPortalController {
  constructor(private readonly studentPortal: StudentPortalService) {}

  @Get("dashboard")
  getDashboard(@CurrentUser() user: JwtPayload) {
    return this.studentPortal.getDashboard(user.organizationId, user.sub);
  }

  @Get("invoices")
  getInvoices(@CurrentUser() user: JwtPayload) {
    return this.studentPortal.getInvoices(user.organizationId, user.sub);
  }

  @Post("invoices/:id/esewa/initiate")
  initiateEsewaPayment(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: InitiateEsewaPaymentDto,
  ) {
    return this.studentPortal.initiateEsewaPayment(user.organizationId, user.sub, id, dto.amount);
  }

  @Post("esewa/verify")
  confirmEsewaPayment(@CurrentUser() user: JwtPayload, @Body() dto: ConfirmEsewaPaymentDto) {
    return this.studentPortal.confirmEsewaPayment(user.organizationId, user.sub, dto.data);
  }

  @Get("courses")
  listCourses(@CurrentUser() user: JwtPayload) {
    return this.studentPortal.listCourses(user.organizationId, user.sub);
  }

  @Get("courses/:teachingAssignmentId/modules")
  listModules(@CurrentUser() user: JwtPayload, @Param("teachingAssignmentId") teachingAssignmentId: string) {
    return this.studentPortal.listModules(user.organizationId, user.sub, teachingAssignmentId);
  }

  @Post("module-items/:itemId/complete")
  completeModuleItem(@CurrentUser() user: JwtPayload, @Param("itemId") itemId: string) {
    return this.studentPortal.completeModuleItem(user.organizationId, user.sub, itemId);
  }

  @Get("assignments")
  listAssignments(@CurrentUser() user: JwtPayload) {
    return this.studentPortal.listAssignments(user.organizationId, user.sub);
  }

  @Get("assignments/:assignmentId")
  getAssignment(@CurrentUser() user: JwtPayload, @Param("assignmentId") assignmentId: string) {
    return this.studentPortal.getAssignment(user.organizationId, user.sub, assignmentId);
  }

  @Post("assignments/:assignmentId/submit")
  submitAssignment(
    @CurrentUser() user: JwtPayload,
    @Param("assignmentId") assignmentId: string,
    @Body() dto: SubmitAssignmentDto,
  ) {
    return this.studentPortal.submitAssignment(user.organizationId, user.sub, assignmentId, dto.content);
  }
}
