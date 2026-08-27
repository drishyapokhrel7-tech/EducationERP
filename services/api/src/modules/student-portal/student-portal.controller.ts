import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from "@nestjs/common";
import { StudentPortalService } from "./student-portal.service";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";
import { InitiateEsewaPaymentDto } from "../finance/dto/initiate-esewa-payment.dto";
import { ConfirmEsewaPaymentDto } from "../finance/dto/confirm-esewa-payment.dto";
import { SubmitAssignmentDto } from "./dto/submit-assignment.dto";
import { SaveQuizAnswerDto } from "../knowledge-checks/dto/save-quiz-answer.dto";
import { CreateDiscussionPostDto } from "../teacher-portal/dto/create-discussion-post.dto";
import { UploadOwnDocumentDto } from "../documents/dto/upload-own-document.dto";
import { UpdateAlumniProfileDto } from "../alumni/dto/update-alumni-profile.dto";
import { CreateEducationDto } from "../alumni/dto/create-education.dto";
import { CreateCareerHistoryDto } from "../alumni/dto/create-career-history.dto";
import { CreateSkillDto } from "../alumni/dto/create-skill.dto";
import { CreateCertificationDto } from "../alumni/dto/create-certification.dto";

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

  @Get("announcements")
  listAnnouncements(@CurrentUser() user: JwtPayload) {
    return this.studentPortal.listAnnouncements(user.organizationId, user.sub);
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

  @Get("quizzes")
  listQuizzes(@CurrentUser() user: JwtPayload) {
    return this.studentPortal.listQuizzes(user.organizationId, user.sub);
  }

  @Get("quizzes/:checkId")
  getQuiz(@CurrentUser() user: JwtPayload, @Param("checkId") checkId: string) {
    return this.studentPortal.getQuiz(user.organizationId, user.sub, checkId);
  }

  @Post("quizzes/:checkId/start")
  startQuiz(@CurrentUser() user: JwtPayload, @Param("checkId") checkId: string) {
    return this.studentPortal.startQuiz(user.organizationId, user.sub, checkId);
  }

  @Put("quizzes/:checkId/answers/:questionId")
  saveQuizAnswer(
    @CurrentUser() user: JwtPayload,
    @Param("checkId") checkId: string,
    @Param("questionId") questionId: string,
    @Body() dto: SaveQuizAnswerDto,
  ) {
    return this.studentPortal.saveQuizAnswer(user.organizationId, user.sub, checkId, questionId, dto);
  }

  @Post("quizzes/:checkId/submit")
  submitQuiz(@CurrentUser() user: JwtPayload, @Param("checkId") checkId: string) {
    return this.studentPortal.submitQuiz(user.organizationId, user.sub, checkId);
  }

  @Get("discussion-topics")
  listDiscussionTopics(@CurrentUser() user: JwtPayload) {
    return this.studentPortal.listDiscussionTopics(user.organizationId, user.sub);
  }

  @Get("discussion-topics/:topicId")
  getDiscussionTopic(@CurrentUser() user: JwtPayload, @Param("topicId") topicId: string) {
    return this.studentPortal.getDiscussionTopic(user.organizationId, user.sub, topicId);
  }

  @Post("discussion-topics/:topicId/posts")
  createDiscussionPost(
    @CurrentUser() user: JwtPayload,
    @Param("topicId") topicId: string,
    @Body() dto: CreateDiscussionPostDto,
  ) {
    return this.studentPortal.createDiscussionPost(user.organizationId, user.sub, topicId, dto);
  }

  @Get("documents")
  listOwnDocuments(@CurrentUser() user: JwtPayload) {
    return this.studentPortal.listOwnDocuments(user.organizationId, user.sub);
  }

  @Post("documents")
  uploadOwnDocument(@CurrentUser() user: JwtPayload, @Body() dto: UploadOwnDocumentDto) {
    return this.studentPortal.uploadOwnDocument(user.organizationId, user.sub, dto);
  }

  @Get("certificates")
  listOwnCertificates(@CurrentUser() user: JwtPayload) {
    return this.studentPortal.listOwnCertificates(user.organizationId, user.sub);
  }

  @Get("alumni-profile")
  getOwnAlumniProfile(@CurrentUser() user: JwtPayload) {
    return this.studentPortal.getOwnAlumniProfile(user.organizationId, user.sub);
  }

  @Patch("alumni-profile")
  updateOwnAlumniProfile(@CurrentUser() user: JwtPayload, @Body() dto: UpdateAlumniProfileDto) {
    return this.studentPortal.updateOwnAlumniProfile(user.organizationId, user.sub, dto);
  }

  @Post("alumni-profile/education")
  addOwnAlumniEducation(@CurrentUser() user: JwtPayload, @Body() dto: CreateEducationDto) {
    return this.studentPortal.addOwnAlumniEducation(user.organizationId, user.sub, dto);
  }

  @Post("alumni-profile/career-history")
  addOwnAlumniCareerHistory(@CurrentUser() user: JwtPayload, @Body() dto: CreateCareerHistoryDto) {
    return this.studentPortal.addOwnAlumniCareerHistory(user.organizationId, user.sub, dto);
  }

  @Post("alumni-profile/skills")
  addOwnAlumniSkill(@CurrentUser() user: JwtPayload, @Body() dto: CreateSkillDto) {
    return this.studentPortal.addOwnAlumniSkill(user.organizationId, user.sub, dto);
  }

  @Post("alumni-profile/certifications")
  addOwnAlumniCertification(@CurrentUser() user: JwtPayload, @Body() dto: CreateCertificationDto) {
    return this.studentPortal.addOwnAlumniCertification(user.organizationId, user.sub, dto);
  }

  @Get("alumni-companies")
  listAlumniCompanies(@CurrentUser() user: JwtPayload) {
    return this.studentPortal.listAlumniCompanies(user.organizationId);
  }
}
