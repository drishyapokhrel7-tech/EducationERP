export * from "./types";

import type {
  AcademicYear,
  AdmissionApplication,
  AdmissionStatusHistoryEntry,
  AttachCurriculumSubjectInput,
  AttachGuardianInput,
  AuthTokens,
  Campus,
  CreateAcademicYearInput,
  CreateAdmissionApplicationInput,
  CreateCampusInput,
  UpdateCampusInput,
  CreateCurriculumInput,
  CreateDepartmentInput,
  CreateDesignationInput,
  CreateEmployeeInput,
  UpdateEmployeeInput,
  CreateEmploymentHistoryInput,
  CreateEnrollmentInput,
  EnrollmentListItem,
  ListEnrollmentsParams,
  EnrollmentStatus,
  CreateFacultyInput,
  CreateGuardianInput,
  UpdateGuardianInput,
  CreateProgramInput,
  CreateQualificationInput,
  CreateSectionInput,
  CreateStaffTypeInput,
  CreateStudentInput,
  UpdateStudentInput,
  CreateStudentLoginInput,
  CreateStudentLoginResult,
  CreateSubjectInput,
  CreateTermInput,
  Curriculum,
  CurriculumSubject,
  Department,
  Designation,
  Employee,
  EmploymentHistory,
  EnrollApplicationInput,
  Faculty,
  Guardian,
  ImportResult,
  LoginInput,
  Organization,
  Program,
  Qualification,
  RegisterOrganizationInput,
  SafeUser,
  Section,
  StaffType,
  Student,
  StudentEnrollment,
  StudentGuardian,
  StudentStatusHistoryEntry,
  Subject,
  TeacherProfile,
  Term,
  UpdateAdmissionStatusInput,
  UpdateStudentStatusInput,
  UpdateFacultyInput,
  UpdateDepartmentInput,
  UpdateProgramInput,
  UpdateAcademicYearInput,
  UpdateTermInput,
  UpdateSectionInput,
  UpdateStaffTypeInput,
  UpdateDesignationInput,
  UpdateSubjectInput,
  UpdateCurriculumInput,
  UpdateRoomInput,
  UpdatePeriodInput,
  UpdateExamTypeInput,
  UpdateGradingSchemeInput,
  UpdateFeeCategoryInput,
  UpdateScholarshipInput,
  UpdateLeaveTypeInput,
  UpdateDriverInput,
  UpdateHostelLookupInput,
  UpdateInventoryCategoryInput,
  UpdateSupplierInput,
  UpdateMessageTemplateInput,
  UpsertTeacherProfileInput,
  Room,
  CreateRoomInput,
  Period,
  CreatePeriodInput,
  TeachingAssignment,
  CreateTeachingAssignmentInput,
  UpdateTeachingAssignmentInput,
  UpdateClassScheduleInput,
  ClassSchedule,
  CreateClassScheduleInput,
  AttendanceSession,
  AttendanceSessionWithRoster,
  CreateAttendanceSessionInput,
  StudentAttendance,
  MarkAttendanceInput,
  CorrectAttendanceInput,
  StaffAttendance,
  CreateStaffAttendanceInput,
  Syllabus,
  SyllabusWithNodes,
  CreateSyllabusInput,
  SyllabusNode,
  CreateSyllabusNodeInput,
  LearningObjective,
  CreateLearningObjectiveInput,
  LessonPlan,
  CreateLessonPlanInput,
  ClassSession,
  CreateClassSessionInput,
  RecordProgressInput,
  ClassMaterial,
  CreateClassMaterialInput,
  MyClassesTodayEntry,
  SyllabusNodeProgress,
  Assignment,
  CreateAssignmentInput,
  UpdateAssignmentInput,
  AssignmentSubmission,
  CreateSubmissionInput,
  GradeSubmissionInput,
  TeacherPortalAssignmentListItem,
  StudentPortalAssignment,
  SubmitAssignmentInput,
  KnowledgeCheck,
  CreateKnowledgeCheckInput,
  KnowledgeCheckQuestion,
  CreateQuestionInput,
  KnowledgeCheckAttempt,
  CreateAttemptInput,
  TeacherPortalQuizListItem,
  StudentPortalQuiz,
  QuizAttemptState,
  SaveQuizAnswerInput,
  Announcement,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
  StudentPortalAnnouncement,
  DiscussionTopic,
  DiscussionTopicWithPosts,
  DiscussionPost,
  CreateDiscussionTopicInput,
  UpdateDiscussionTopicInput,
  CreateDiscussionPostInput,
  StudentPortalDiscussionTopic,
  Notification,
  UploadResult,
  HostelRecord,
  CreateHostelInput,
  HostelBuildingRecord,
  CreateHostelBuildingInput,
  HostelRoomRecord,
  CreateHostelRoomInput,
  HostelBedRecord,
  CreateHostelBedInput,
  UpdateHostelBedInput,
  VacantHostelBedRecord,
  AllocateHostelBedInput,
  HostelAllocationRecord,
  MarkHostelAttendanceInput,
  HostelAttendanceRecord,
  LogHostelVisitorInput,
  HostelVisitorRecord,
  CreateHostelComplaintInput,
  UpdateHostelComplaintInput,
  HostelComplaintRecord,
  CreateHostelMaintenanceRequestInput,
  UpdateHostelMaintenanceRequestInput,
  HostelMaintenanceRequestRecord,
  HostelLookupKind,
  CreateHostelLookupInput,
  HostelLookupRecord,
  CreateInventoryCategoryInput,
  InventoryCategoryRecord,
  CreateSupplierInput,
  SupplierRecord,
  CreateInventoryItemInput,
  InventoryItemRecord,
  CreatePurchaseOrderInput,
  PurchaseOrderRecord,
  AddPurchaseOrderItemInput,
  PurchaseOrderItemRecord,
  ReceivePurchaseOrderInput,
  CreateStockAdjustmentInput,
  StockMovementRecord,
  CreateAssetInput,
  AssetRecord,
  UpdateAssetInput,
  AssignAssetInput,
  AssetAssignmentRecord,
  CreateMessageTemplateInput,
  MessageTemplateRecord,
  CreateMessageInput,
  MessageRecord,
  MessageRecipientPreview,
  CreateStudentDocumentInput,
  UploadOwnDocumentInput,
  ReviewDocumentInput,
  StudentDocumentRecord,
  CreateStaffDocumentInput,
  StaffDocumentRecord,
  CreateCertificateInput,
  RevokeCertificateInput,
  CertificateRecord,
  PublicCertificateVerification,
  CreateAlumniProfileInput,
  UpdateAlumniProfileInput,
  AlumniProfileRecord,
  CreateAlumniCompanyInput,
  AlumniCompanyRecord,
  CreateAlumniEducationInput,
  AlumniEducationRecord,
  CreateAlumniCareerHistoryInput,
  UpdateAlumniCareerHistoryInput,
  AlumniCareerHistoryRecord,
  CreateAlumniSkillInput,
  AlumniSkillRecord,
  CreateAlumniCertificationInput,
  AlumniCertificationRecord,
  AlumniSurveyRecord,
  CreateAlumniSurveyInput,
  UpdateAlumniSurveyInput,
  SubmitAlumniSurveyResponseInput,
  AlumniSurveyResponseRecord,
  AlumniMentorshipRecord,
  CreateAlumniMentorshipInput,
  RespondAlumniMentorshipInput,
  AlumniAchievementRecord,
  CreateAlumniAchievementInput,
  CareerOpportunityRecord,
  CreateOpportunityInput,
  ReviewOpportunityInput,
  CareerApplicationRecord,
  CreateApplicationInput,
  UpdateApplicationStatusInput,
  CareerServiceRecord,
  CreateCareerServiceInput,
  UpdateCareerServiceInput,
  GraduateOutcomeRecord,
  SetGraduateOutcomeInput,
  OperationalAnalytics,
  AcademicAnalytics,
  AttendanceAnalytics,
  EnrollmentAnalytics,
  FinancialAnalytics,
  ExaminationAnalytics,
  ContinuousLearningAnalytics,
  AlumniOutcomesAnalytics,
  AnalyticsExportFormat,
  SearchResult,
  PaginatedResult,
  PaginationParams,
  InvoiceListItem,
  StudentPicker,
  EmployeePicker,
  CaptchaChallenge,
  EmailVerificationChallenge,
  PasswordResetChallenge,
  CurrentUserInfo,
  EditionStatus,
  Edition,
  PlatformAdminUser,
  PlatformOrganizationSummary,
  PlatformUpgradeRequestSummary,
  UpdateOrganizationInput,
  RegisterGatewayDeviceInput,
  GatewayDeviceRecord,
  GatewayScanInput,
  GatewayScanResult,
  BindGatewayCardInput,
  GatewayCardBindingRecord,
  GatewayScanEvent,
  TeacherDashboard,
  StudentDashboard,
  ParentDashboard,
  ExamType,
  CreateExamTypeInput,
  GradingScheme,
  CreateGradingSchemeInput,
  QuestionBankSummary,
  QuestionBank,
  CreateQuestionBankInput,
  ExamQuestion,
  CreateExamQuestionInput,
  ExamSummary,
  Exam,
  CreateExamInput,
  ExamSubjectRecord,
  CreateExamSubjectInput,
  ExamScheduleRecord,
  CreateExamScheduleInput,
  ExamRoomRecord,
  CreateExamRoomInput,
  ExamAttempt,
  ExamAttemptRecord,
  RecordExamAttemptInput,
  MarksRecord,
  RecordMarksInput,
  GradeRecord,
  ReportCard,
  ReportCardRecord,
  MyExamAttempt,
  ExamTakingState,
  SaveAnswerInput,
  AnswerRecord,
  AnswerWithQuestion,
  BiometricPolicyRecord,
  UpdateBiometricPolicyInput,
  CreateFaceEnrollmentInput,
  FaceEnrollmentRecord,
  FaceEnrollment,
  AddEnrollmentPhotoResult,
  CreateCameraInput,
  CameraRecord,
  CameraEventResult,
  FaceMatchEvent,
  FaceMatchEventRecord,
  ReviewFaceMatchInput,
  FeeCategoryRecord,
  CreateFeeCategoryInput,
  FeeStructureRecord,
  CreateFeeStructureInput,
  AssignFeeStructureInput,
  AssignFeeStructureBulkInput,
  AssignFeeStructureBulkResult,
  AssignFeeStructureBulkPreview,
  InvoiceRecord,
  RecordPaymentInput,
  PaymentRecord,
  ApplyDiscountInput,
  DiscountRecord,
  IssueRefundInput,
  RefundRecord,
  InitiateEsewaPaymentInput,
  EsewaFormPayload,
  ConfirmEsewaPaymentResult,
  InitiateUpgradeInput,
  ConfirmUpgradeResult,
  SubmitUpgradeRequestInput,
  SubmitUpgradeRequestResult,
  PortalInvoiceRecord,
  RoleRecord,
  PermissionRecord,
  CreateRoleInput,
  UpdateRoleInput,
  UserSummary,
  UserRoleAssignment,
  AssignRoleInput,
  AuditLogRecord,
  LeaveRequestStatus,
  LeaveTypeRecord,
  CreateLeaveTypeInput,
  AllocateLeaveBalanceInput,
  StaffLeaveBalanceRecord,
  CreateLeaveRequestInput,
  ReviewLeaveRequestInput,
  LeaveRequestRecord,
  ScholarshipRecord,
  CreateScholarshipInput,
  AssignScholarshipInput,
  StudentScholarshipRecord,
  FinancialTransactionRecord,
  SalaryStructureItemInput,
  CreateSalaryStructureInput,
  SalaryStructureRecord,
  GeneratePayrollInput,
  GeneratePayrollResult,
  PayrollGenerationPreview,
  AddPayrollItemInput,
  MarkPayrollPaidInput,
  PayrollStatus,
  PayrollRecord,
  VehicleRecord,
  CreateVehicleInput,
  UpdateVehicleInput,
  DriverRecord,
  CreateDriverInput,
  RouteRecord,
  CreateRouteInput,
  UpdateRouteInput,
  AddStopInput,
  AssignStudentTransportInput,
  StudentTransportAssignmentRecord,
  StopRecord,
  VehicleTrackingEventRecord,
  VehicleTrackingEventWithVehicle,
  SubmitTrackingInput,
  DriverPortalMe,
  CreateEmployeeLoginInput,
  CreateEmployeeLoginResult,
  TeacherPortalMe,
  TeacherPortalClassToday,
  TeacherPortalSyllabusNode,
  CourseModuleRecord,
  CreateCourseModuleInput,
  UpdateCourseModuleInput,
  CourseModuleItemRecord,
  CreateCourseModuleItemInput,
  UpdateCourseModuleItemInput,
  StudentPortalCourse,
  StudentPortalModule,
} from "./types";

export class ApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`API request failed with status ${status}`);
  }
}

// A hung backend request — this project's own documented ambient-Neon-
// latency failure mode, where the API's own handler can genuinely
// block for a long time on a stuck DB connection rather than ever
// responding — never resolves OR rejects a plain `fetch()`'s promise.
// Without a bound, a caller waiting on that promise (an SWR hook,
// most of the time) never gets an error either — the UI can't tell
// "still loading" from "stuck forever" apart, no matter how long a
// user waits. This gives every request a fixed ceiling so a truly
// stuck one eventually rejects instead of hanging indefinitely.
const REQUEST_TIMEOUT_MS = 30_000;

function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | null | undefined;
}

export function createApiClient({ baseUrl, getAccessToken }: ApiClientOptions) {
  // timeoutMs is a rare per-call override, not a general knob — only
  // for the handful of calls known to scale with real data volume
  // rather than being a fixed-cost request (platformListOrganizations
  // below is the concrete case: platform-organizations.service.ts's
  // own comment explains why it scans every org sequentially rather
  // than in parallel, so its real-world duration grows with however
  // many orgs this environment has accumulated).
  async function request<T>(path: string, init: RequestInit = {}, timeoutMs?: number): Promise<T> {
    const token = getAccessToken?.();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetchWithTimeout(`${baseUrl}${path}`, { ...init, headers }, timeoutMs);
    const body = res.status === 204 ? undefined : await res.json().catch(() => undefined);
    if (!res.ok) {
      throw new ApiError(res.status, body);
    }
    return body as T;
  }

  // Multipart upload: no Content-Type set manually — the browser adds
  // the multipart boundary itself when the body is a FormData instance,
  // and setting it by hand breaks that.
  async function requestForm<T>(path: string, form: FormData): Promise<T> {
    const token = getAccessToken?.();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetchWithTimeout(`${baseUrl}${path}`, { method: "POST", body: form, headers });
    const body = await res.json().catch(() => undefined);
    if (!res.ok) throw new ApiError(res.status, body);
    return body as T;
  }

  // Phase 8 performance-optimization slice — shared by every paginated
  // list method below.
  function paginationQuery(pagination?: PaginationParams): string {
    const params = new URLSearchParams();
    if (pagination?.page) params.set("page", String(pagination.page));
    if (pagination?.pageSize) params.set("pageSize", String(pagination.pageSize));
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }

  // The response is a raw CSV file, not JSON — fetched as a Blob so the
  // caller can trigger a normal browser download.
  async function requestBlob(path: string): Promise<Blob> {
    const token = getAccessToken?.();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetchWithTimeout(`${baseUrl}${path}`, { headers });
    if (!res.ok) {
      const body = await res.json().catch(() => undefined);
      throw new ApiError(res.status, body);
    }
    return res.blob();
  }

  return {
    registerOrganization: (input: RegisterOrganizationInput) =>
      request<{ organization: Organization; user: SafeUser; emailVerification: EmailVerificationChallenge } & AuthTokens>(
        "/auth/register-organization",
        { method: "POST", body: JSON.stringify(input) },
      ),

    verifyEmail: (input: { codeId: string; code: string }) =>
      request<{ verified: boolean }>("/auth/verify-email", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    resendVerificationCode: () =>
      request<EmailVerificationChallenge>("/auth/resend-verification-code", { method: "POST" }),

    // SafeUser (stored in the session) has no roles field — the
    // user-profile popup fetches this separately for "Role".
    getMe: () => request<CurrentUserInfo>("/auth/me", { method: "POST" }),

    login: (input: LoginInput) =>
      request<{ user: SafeUser } & AuthTokens>("/auth/login", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    // No auth needed — happens before login. Reused by both the
    // tenant login form and the platform-admin login form.
    getCaptcha: () => request<CaptchaChallenge>("/auth/captcha"),

    // Unauthenticated by nature — main tenant login only.
    forgotPassword: (input: { identifier: string; captchaId: string; captchaAnswer: string }) =>
      request<PasswordResetChallenge>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    resetPassword: (input: { codeId: string; code: string; newPassword: string }) =>
      request<{ reset: boolean }>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    refresh: (refreshToken: string) =>
      request<AuthTokens>("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      }),

    logout: (refreshToken: string) =>
      request<void>("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) }),

    getOwnOrganization: () => request<Organization>("/organizations/me"),

    getEditionStatus: () => request<EditionStatus>("/organizations/me/edition-status"),

    listCampuses: () => request<Campus[]>("/organizations/me/campuses"),

    createCampus: (input: CreateCampusInput) =>
      request<Campus>("/organizations/me/campuses", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    updateCampus: (id: string, input: UpdateCampusInput) =>
      request<Campus>(`/organizations/me/campuses/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    deleteCampus: (id: string) =>
      request<{ deleted: true }>(`/organizations/me/campuses/${id}`, { method: "DELETE" }),

    listFaculties: () => request<Faculty[]>("/organizations/me/faculties"),
    createFaculty: (input: CreateFacultyInput) =>
      request<Faculty>("/organizations/me/faculties", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    updateFaculty: (id: string, input: UpdateFacultyInput) =>
      request<Faculty>(`/organizations/me/faculties/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    deleteFaculty: (id: string) =>
      request<{ deleted: true }>(`/organizations/me/faculties/${id}`, { method: "DELETE" }),

    listDepartments: () => request<Department[]>("/organizations/me/departments"),
    createDepartment: (input: CreateDepartmentInput) =>
      request<Department>("/organizations/me/departments", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    updateDepartment: (id: string, input: UpdateDepartmentInput) =>
      request<Department>(`/organizations/me/departments/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    deleteDepartment: (id: string) =>
      request<{ deleted: true }>(`/organizations/me/departments/${id}`, { method: "DELETE" }),

    listPrograms: () => request<Program[]>("/organizations/me/programs"),
    createProgram: (input: CreateProgramInput) =>
      request<Program>("/organizations/me/programs", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    updateProgram: (id: string, input: UpdateProgramInput) =>
      request<Program>(`/organizations/me/programs/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    deleteProgram: (id: string) =>
      request<{ deleted: true }>(`/organizations/me/programs/${id}`, { method: "DELETE" }),

    listAcademicYears: () => request<AcademicYear[]>("/organizations/me/academic-years"),
    createAcademicYear: (input: CreateAcademicYearInput) =>
      request<AcademicYear>("/organizations/me/academic-years", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    updateAcademicYear: (id: string, input: UpdateAcademicYearInput) =>
      request<AcademicYear>(`/organizations/me/academic-years/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    deleteAcademicYear: (id: string) =>
      request<{ deleted: true }>(`/organizations/me/academic-years/${id}`, { method: "DELETE" }),

    listTerms: () => request<Term[]>("/organizations/me/terms"),
    createTerm: (input: CreateTermInput) =>
      request<Term>("/organizations/me/terms", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    updateTerm: (id: string, input: UpdateTermInput) =>
      request<Term>(`/organizations/me/terms/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    deleteTerm: (id: string) => request<{ deleted: true }>(`/organizations/me/terms/${id}`, { method: "DELETE" }),

    listSections: () => request<Section[]>("/organizations/me/sections"),
    createSection: (input: CreateSectionInput) =>
      request<Section>("/organizations/me/sections", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    updateSection: (id: string, input: UpdateSectionInput) =>
      request<Section>(`/organizations/me/sections/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    deleteSection: (id: string) =>
      request<{ deleted: true }>(`/organizations/me/sections/${id}`, { method: "DELETE" }),

    listStaffTypes: () => request<StaffType[]>("/organizations/me/staff-types"),
    createStaffType: (input: CreateStaffTypeInput) =>
      request<StaffType>("/organizations/me/staff-types", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    updateStaffType: (id: string, input: UpdateStaffTypeInput) =>
      request<StaffType>(`/organizations/me/staff-types/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    deleteStaffType: (id: string) =>
      request<{ deleted: true }>(`/organizations/me/staff-types/${id}`, { method: "DELETE" }),

    listDesignations: () => request<Designation[]>("/organizations/me/designations"),
    createDesignation: (input: CreateDesignationInput) =>
      request<Designation>("/organizations/me/designations", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    updateDesignation: (id: string, input: UpdateDesignationInput) =>
      request<Designation>(`/organizations/me/designations/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    deleteDesignation: (id: string) =>
      request<{ deleted: true }>(`/organizations/me/designations/${id}`, { method: "DELETE" }),

    listEmployees: (pagination?: PaginationParams) =>
      request<PaginatedResult<Employee>>(`/organizations/me/employees${paginationQuery(pagination)}`),
    listEmployeesPicker: () => request<EmployeePicker[]>("/organizations/me/employees/picker"),
    createEmployee: (input: CreateEmployeeInput) =>
      request<Employee>("/organizations/me/employees", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    updateEmployee: (id: string, input: UpdateEmployeeInput) =>
      request<Employee>(`/organizations/me/employees/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    deleteEmployee: (id: string) =>
      request<{ deleted: true }>(`/organizations/me/employees/${id}`, { method: "DELETE" }),
    createEmployeeLogin: (employeeId: string, input: CreateEmployeeLoginInput) =>
      request<CreateEmployeeLoginResult>(`/organizations/me/employees/${employeeId}/create-login`, {
        method: "POST",
        body: JSON.stringify(input),
      }),

    listEmploymentHistory: (employeeId: string) =>
      request<EmploymentHistory[]>(`/organizations/me/employees/${employeeId}/employment-history`),
    createEmploymentHistory: (employeeId: string, input: CreateEmploymentHistoryInput) =>
      request<EmploymentHistory>(`/organizations/me/employees/${employeeId}/employment-history`, {
        method: "POST",
        body: JSON.stringify(input),
      }),

    listQualifications: (employeeId: string) =>
      request<Qualification[]>(`/organizations/me/employees/${employeeId}/qualifications`),
    createQualification: (employeeId: string, input: CreateQualificationInput) =>
      request<Qualification>(`/organizations/me/employees/${employeeId}/qualifications`, {
        method: "POST",
        body: JSON.stringify(input),
      }),

    getTeacherProfile: (employeeId: string) =>
      request<TeacherProfile | null>(`/organizations/me/employees/${employeeId}/teacher-profile`),
    upsertTeacherProfile: (employeeId: string, input: UpsertTeacherProfileInput) =>
      request<TeacherProfile>(`/organizations/me/employees/${employeeId}/teacher-profile`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),

    listSubjects: () => request<Subject[]>("/organizations/me/subjects"),
    createSubject: (input: CreateSubjectInput) =>
      request<Subject>("/organizations/me/subjects", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    updateSubject: (id: string, input: UpdateSubjectInput) =>
      request<Subject>(`/organizations/me/subjects/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    deleteSubject: (id: string) =>
      request<{ deleted: true }>(`/organizations/me/subjects/${id}`, { method: "DELETE" }),

    listCurricula: () => request<Curriculum[]>("/organizations/me/curricula"),
    createCurriculum: (input: CreateCurriculumInput) =>
      request<Curriculum>("/organizations/me/curricula", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    updateCurriculum: (id: string, input: UpdateCurriculumInput) =>
      request<Curriculum>(`/organizations/me/curricula/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    deleteCurriculum: (id: string) =>
      request<{ deleted: true }>(`/organizations/me/curricula/${id}`, { method: "DELETE" }),
    attachCurriculumSubject: (curriculumId: string, input: AttachCurriculumSubjectInput) =>
      request<CurriculumSubject>(`/organizations/me/curricula/${curriculumId}/subjects`, {
        method: "POST",
        body: JSON.stringify(input),
      }),

    listStudents: (pagination?: PaginationParams) =>
      request<PaginatedResult<Student>>(`/organizations/me/students${paginationQuery(pagination)}`),
    listStudentsPicker: () => request<StudentPicker[]>("/organizations/me/students/picker"),
    createStudent: (input: CreateStudentInput) =>
      request<Student>("/organizations/me/students", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    updateStudent: (id: string, input: UpdateStudentInput) =>
      request<Student>(`/organizations/me/students/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    deleteStudent: (id: string) =>
      request<{ deleted: true }>(`/organizations/me/students/${id}`, { method: "DELETE" }),
    createStudentLogin: (studentId: string, input: CreateStudentLoginInput) =>
      request<CreateStudentLoginResult>(`/organizations/me/students/${studentId}/create-login`, {
        method: "POST",
        body: JSON.stringify(input),
      }),

    listGuardians: () => request<Guardian[]>("/organizations/me/guardians"),
    createGuardian: (input: CreateGuardianInput) =>
      request<Guardian>("/organizations/me/guardians", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    updateGuardian: (id: string, input: UpdateGuardianInput) =>
      request<Guardian>(`/organizations/me/guardians/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    deleteGuardian: (id: string) =>
      request<{ deleted: true }>(`/organizations/me/guardians/${id}`, { method: "DELETE" }),
    attachGuardian: (studentId: string, input: AttachGuardianInput) =>
      request<StudentGuardian>(`/organizations/me/students/${studentId}/guardians`, {
        method: "POST",
        body: JSON.stringify(input),
      }),

    listEnrollments: (studentId: string) =>
      request<StudentEnrollment[]>(`/organizations/me/students/${studentId}/enrollments`),
    createEnrollment: (studentId: string, input: CreateEnrollmentInput) =>
      request<StudentEnrollment>(`/organizations/me/students/${studentId}/enrollments`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    // Org-wide, filterable, paginated — the real list behind the
    // Enrollment card (was previously create-only, no way to see who's
    // enrolled afterward).
    listAllEnrollments: (params: ListEnrollmentsParams = {}) => {
      const q = new URLSearchParams();
      if (params.page) q.set("page", String(params.page));
      if (params.pageSize) q.set("pageSize", String(params.pageSize));
      if (params.programId) q.set("programId", params.programId);
      if (params.termId) q.set("termId", params.termId);
      if (params.sectionId) q.set("sectionId", params.sectionId);
      if (params.status) q.set("status", params.status);
      const qs = q.toString();
      return request<PaginatedResult<EnrollmentListItem>>(`/organizations/me/enrollments${qs ? `?${qs}` : ""}`);
    },
    updateEnrollmentStatus: (id: string, status: EnrollmentStatus) =>
      request<EnrollmentListItem>(`/organizations/me/enrollments/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),

    listStatusHistory: (studentId: string) =>
      request<StudentStatusHistoryEntry[]>(`/organizations/me/students/${studentId}/status-history`),
    updateStudentStatus: (studentId: string, input: UpdateStudentStatusInput) =>
      request<StudentStatusHistoryEntry>(`/organizations/me/students/${studentId}/status`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),

    listAdmissionApplications: () =>
      request<AdmissionApplication[]>("/organizations/me/admission-applications"),
    createAdmissionApplication: (input: CreateAdmissionApplicationInput) =>
      request<AdmissionApplication>("/organizations/me/admission-applications", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    listAdmissionStatusHistory: (applicationId: string) =>
      request<AdmissionStatusHistoryEntry[]>(
        `/organizations/me/admission-applications/${applicationId}/status-history`,
      ),
    updateAdmissionStatus: (applicationId: string, input: UpdateAdmissionStatusInput) =>
      request<AdmissionStatusHistoryEntry>(
        `/organizations/me/admission-applications/${applicationId}/status`,
        { method: "PUT", body: JSON.stringify(input) },
      ),
    enrollApplication: (applicationId: string, input: EnrollApplicationInput) =>
      request<Student>(`/organizations/me/admission-applications/${applicationId}/enroll`, {
        method: "POST",
        body: JSON.stringify(input),
      }),

    importStudents: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return requestForm<ImportResult>("/organizations/me/students/import", form);
    },
    downloadStudentImportTemplate: () => requestBlob("/organizations/me/students/import-template"),
    exportStudents: () => requestBlob("/organizations/me/students/export"),

    listRooms: () => request<Room[]>("/organizations/me/rooms"),
    createRoom: (input: CreateRoomInput) =>
      request<Room>("/organizations/me/rooms", { method: "POST", body: JSON.stringify(input) }),
    updateRoom: (id: string, input: UpdateRoomInput) =>
      request<Room>(`/organizations/me/rooms/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    deleteRoom: (id: string) => request<{ deleted: true }>(`/organizations/me/rooms/${id}`, { method: "DELETE" }),

    listPeriods: () => request<Period[]>("/organizations/me/periods"),
    createPeriod: (input: CreatePeriodInput) =>
      request<Period>("/organizations/me/periods", { method: "POST", body: JSON.stringify(input) }),
    updatePeriod: (id: string, input: UpdatePeriodInput) =>
      request<Period>(`/organizations/me/periods/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    deletePeriod: (id: string) => request<{ deleted: true }>(`/organizations/me/periods/${id}`, { method: "DELETE" }),

    listTeachingAssignments: () =>
      request<TeachingAssignment[]>("/organizations/me/teaching-assignments"),
    createTeachingAssignment: (input: CreateTeachingAssignmentInput) =>
      request<TeachingAssignment>("/organizations/me/teaching-assignments", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    updateTeachingAssignment: (id: string, input: UpdateTeachingAssignmentInput) =>
      request<TeachingAssignment>(`/organizations/me/teaching-assignments/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    deleteTeachingAssignment: (id: string) =>
      request<{ deleted: true }>(`/organizations/me/teaching-assignments/${id}`, { method: "DELETE" }),

    listClassSchedules: () => request<ClassSchedule[]>("/organizations/me/class-schedules"),
    createClassSchedule: (input: CreateClassScheduleInput) =>
      request<ClassSchedule>("/organizations/me/class-schedules", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    updateClassSchedule: (id: string, input: UpdateClassScheduleInput) =>
      request<ClassSchedule>(`/organizations/me/class-schedules/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    deleteClassSchedule: (id: string) =>
      request<{ deleted: true }>(`/organizations/me/class-schedules/${id}`, { method: "DELETE" }),

    listAttendanceSessions: () => request<AttendanceSession[]>("/organizations/me/attendance-sessions"),
    createAttendanceSession: (input: CreateAttendanceSessionInput) =>
      request<AttendanceSessionWithRoster>("/organizations/me/attendance-sessions", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    getAttendanceSession: (sessionId: string) =>
      request<AttendanceSessionWithRoster>(`/organizations/me/attendance-sessions/${sessionId}`),
    markAttendance: (sessionId: string, input: MarkAttendanceInput) =>
      request<StudentAttendance[]>(`/organizations/me/attendance-sessions/${sessionId}/mark`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    correctAttendance: (sessionId: string, studentId: string, input: CorrectAttendanceInput) =>
      request<StudentAttendance>(
        `/organizations/me/attendance-sessions/${sessionId}/students/${studentId}`,
        { method: "PUT", body: JSON.stringify(input) },
      ),

    listStaffAttendance: () => request<StaffAttendance[]>("/organizations/me/staff-attendance"),
    markStaffAttendance: (input: CreateStaffAttendanceInput) =>
      request<StaffAttendance>("/organizations/me/staff-attendance", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    listSyllabi: () => request<Syllabus[]>("/organizations/me/syllabi"),
    createSyllabus: (input: CreateSyllabusInput) =>
      request<Syllabus>("/organizations/me/syllabi", { method: "POST", body: JSON.stringify(input) }),
    getSyllabus: (syllabusId: string) =>
      request<SyllabusWithNodes>(`/organizations/me/syllabi/${syllabusId}`),
    createSyllabusNode: (syllabusId: string, input: CreateSyllabusNodeInput) =>
      request<SyllabusNode>(`/organizations/me/syllabi/${syllabusId}/nodes`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    createLearningObjective: (nodeId: string, input: CreateLearningObjectiveInput) =>
      request<LearningObjective>(`/organizations/me/syllabus-nodes/${nodeId}/objectives`, {
        method: "POST",
        body: JSON.stringify(input),
      }),

    listLessonPlans: () => request<LessonPlan[]>("/organizations/me/lesson-plans"),
    createLessonPlan: (input: CreateLessonPlanInput) =>
      request<LessonPlan>("/organizations/me/lesson-plans", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    myClassesToday: (date: string) =>
      request<MyClassesTodayEntry[]>(`/organizations/me/my-classes-today?date=${encodeURIComponent(date)}`),
    createClassSession: (input: CreateClassSessionInput) =>
      request<ClassSession>("/organizations/me/class-sessions", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    getClassSession: (sessionId: string) =>
      request<ClassSession>(`/organizations/me/class-sessions/${sessionId}`),
    recordProgress: (sessionId: string, input: RecordProgressInput) =>
      request<ClassSession>(`/organizations/me/class-sessions/${sessionId}/progress`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    addClassMaterial: (sessionId: string, input: CreateClassMaterialInput) =>
      request<ClassMaterial>(`/organizations/me/class-sessions/${sessionId}/materials`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    completeClassSession: (sessionId: string) =>
      request<ClassSession>(`/organizations/me/class-sessions/${sessionId}/complete`, { method: "POST" }),
    getSyllabusProgress: (syllabusId: string) =>
      request<SyllabusNodeProgress[]>(`/organizations/me/syllabi/${syllabusId}/progress`),

    listAssignments: () => request<Assignment[]>("/organizations/me/assignments"),
    createAssignment: (input: CreateAssignmentInput) =>
      request<Assignment>("/organizations/me/assignments", { method: "POST", body: JSON.stringify(input) }),
    getAssignment: (assignmentId: string) =>
      request<Assignment>(`/organizations/me/assignments/${assignmentId}`),
    updateAssignment: (assignmentId: string, input: UpdateAssignmentInput) =>
      request<Assignment>(`/organizations/me/assignments/${assignmentId}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    submitAssignment: (assignmentId: string, input: CreateSubmissionInput) =>
      request<AssignmentSubmission>(`/organizations/me/assignments/${assignmentId}/submissions`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    gradeSubmission: (assignmentId: string, studentId: string, input: GradeSubmissionInput) =>
      request<AssignmentSubmission>(
        `/organizations/me/assignments/${assignmentId}/submissions/${studentId}/grade`,
        { method: "PUT", body: JSON.stringify(input) },
      ),

    listKnowledgeChecks: () => request<KnowledgeCheck[]>("/organizations/me/knowledge-checks"),
    createKnowledgeCheck: (input: CreateKnowledgeCheckInput) =>
      request<KnowledgeCheck>("/organizations/me/knowledge-checks", { method: "POST", body: JSON.stringify(input) }),
    getKnowledgeCheck: (checkId: string) =>
      request<KnowledgeCheck>(`/organizations/me/knowledge-checks/${checkId}`),
    addKnowledgeCheckQuestion: (checkId: string, input: CreateQuestionInput) =>
      request<KnowledgeCheckQuestion>(`/organizations/me/knowledge-checks/${checkId}/questions`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    publishKnowledgeCheck: (checkId: string) =>
      request<KnowledgeCheck>(`/organizations/me/knowledge-checks/${checkId}/publish`, { method: "POST" }),
    attemptKnowledgeCheck: (checkId: string, input: CreateAttemptInput) =>
      request<KnowledgeCheckAttempt>(`/organizations/me/knowledge-checks/${checkId}/attempts`, {
        method: "POST",
        body: JSON.stringify(input),
      }),

    getTeacherDashboard: (employeeId: string) =>
      request<TeacherDashboard>(`/organizations/me/dashboards/teacher/${employeeId}`),
    getStudentDashboard: (studentId: string) =>
      request<StudentDashboard>(`/organizations/me/dashboards/student/${studentId}`),
    getParentDashboard: (guardianId: string) =>
      request<ParentDashboard>(`/organizations/me/dashboards/parent/${guardianId}`),

    listExamTypes: () => request<ExamType[]>("/organizations/me/exam-types"),
    createExamType: (input: CreateExamTypeInput) =>
      request<ExamType>("/organizations/me/exam-types", { method: "POST", body: JSON.stringify(input) }),
    updateExamType: (id: string, input: UpdateExamTypeInput) =>
      request<ExamType>(`/organizations/me/exam-types/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    deleteExamType: (id: string) =>
      request<{ deleted: true }>(`/organizations/me/exam-types/${id}`, { method: "DELETE" }),

    listGradingSchemes: () => request<GradingScheme[]>("/organizations/me/grading-schemes"),
    createGradingScheme: (input: CreateGradingSchemeInput) =>
      request<GradingScheme>("/organizations/me/grading-schemes", { method: "POST", body: JSON.stringify(input) }),
    updateGradingScheme: (id: string, input: UpdateGradingSchemeInput) =>
      request<GradingScheme>(`/organizations/me/grading-schemes/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    deleteGradingScheme: (id: string) =>
      request<{ deleted: true }>(`/organizations/me/grading-schemes/${id}`, { method: "DELETE" }),

    listQuestionBanks: () => request<QuestionBankSummary[]>("/organizations/me/question-banks"),
    createQuestionBank: (input: CreateQuestionBankInput) =>
      request<QuestionBankSummary>("/organizations/me/question-banks", { method: "POST", body: JSON.stringify(input) }),
    getQuestionBank: (questionBankId: string) =>
      request<QuestionBank>(`/organizations/me/question-banks/${questionBankId}`),
    addExamQuestion: (questionBankId: string, input: CreateExamQuestionInput) =>
      request<ExamQuestion>(`/organizations/me/question-banks/${questionBankId}/questions`, {
        method: "POST",
        body: JSON.stringify(input),
      }),

    listExams: () => request<ExamSummary[]>("/organizations/me/exams"),
    createExam: (input: CreateExamInput) =>
      request<ExamSummary>("/organizations/me/exams", { method: "POST", body: JSON.stringify(input) }),
    getExam: (examId: string) => request<Exam>(`/organizations/me/exams/${examId}`),
    addExamSubject: (examId: string, input: CreateExamSubjectInput) =>
      request<ExamSubjectRecord>(`/organizations/me/exams/${examId}/subjects`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    createExamSchedule: (examSubjectId: string, input: CreateExamScheduleInput) =>
      request<ExamScheduleRecord>(`/organizations/me/exam-subjects/${examSubjectId}/schedule`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    addExamRoom: (examScheduleId: string, input: CreateExamRoomInput) =>
      request<ExamRoomRecord>(`/organizations/me/exam-schedules/${examScheduleId}/rooms`, {
        method: "POST",
        body: JSON.stringify(input),
      }),

    listExamAttempts: (examSubjectId: string) =>
      request<ExamAttempt[]>(`/organizations/me/exam-subjects/${examSubjectId}/attempts`),
    recordExamAttempt: (examSubjectId: string, input: RecordExamAttemptInput) =>
      request<ExamAttemptRecord>(`/organizations/me/exam-subjects/${examSubjectId}/attempts`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    recordMarks: (examAttemptId: string, input: RecordMarksInput) =>
      request<MarksRecord>(`/organizations/me/exam-attempts/${examAttemptId}/marks`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    listExamAnswers: (examAttemptId: string) =>
      request<AnswerWithQuestion[]>(`/organizations/me/exam-attempts/${examAttemptId}/answers`),

    computeGrade: (examAttemptId: string) =>
      request<GradeRecord>(`/organizations/me/exam-attempts/${examAttemptId}/grade`, { method: "POST" }),
    generateReportCard: (examId: string, studentId: string) =>
      request<ReportCardRecord>(`/organizations/me/exams/${examId}/students/${studentId}/report-card`, {
        method: "POST",
      }),
    getReportCard: (examId: string, studentId: string) =>
      request<ReportCard>(`/organizations/me/exams/${examId}/students/${studentId}/report-card`),

    // No studentId param — the server derives it from the caller's own
    // linked Student row. See StudentPortalService.
    getPortalDashboard: () => request<StudentDashboard>("/organizations/me/portal/dashboard"),

    // Self-service exam-taking — same "no studentId param" reasoning as
    // the portal dashboard above. See ExamTakingService.
    listMyExams: () => request<MyExamAttempt[]>("/organizations/me/portal/exams"),
    startMyExam: (examSubjectId: string) =>
      request<ExamTakingState>(`/organizations/me/portal/exams/${examSubjectId}/start`, { method: "POST" }),
    saveMyAnswer: (examSubjectId: string, questionId: string, input: SaveAnswerInput) =>
      request<AnswerRecord>(`/organizations/me/portal/exams/${examSubjectId}/answers/${questionId}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    submitMyExam: (examSubjectId: string) =>
      request<ExamAttemptRecord>(`/organizations/me/portal/exams/${examSubjectId}/submit`, { method: "POST" }),

    // Self-service Finance / eSewa (Phase 7 slice 7a-2) — same
    // "no studentId param" reasoning as the portal dashboard above.
    getPortalInvoices: () => request<PortalInvoiceRecord[]>("/organizations/me/portal/invoices"),
    initiatePortalEsewaPayment: (invoiceId: string, input: InitiateEsewaPaymentInput) =>
      request<EsewaFormPayload>(`/organizations/me/portal/invoices/${invoiceId}/esewa/initiate`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    confirmPortalEsewaPayment: (data: string) =>
      request<ConfirmEsewaPaymentResult>("/organizations/me/portal/esewa/verify", {
        method: "POST",
        body: JSON.stringify({ data }),
      }),

    // CCTV/Biometric privacy & consent foundation (Phase 6 slice 6a) —
    // no capture/matching capability yet, see BiometricPolicyService.
    getBiometricPolicy: () => request<BiometricPolicyRecord>("/organizations/me/biometric-policy"),
    updateBiometricPolicy: (input: UpdateBiometricPolicyInput) =>
      request<BiometricPolicyRecord>("/organizations/me/biometric-policy", {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    createFaceEnrollment: (input: CreateFaceEnrollmentInput) =>
      request<FaceEnrollmentRecord>("/organizations/me/biometric/enrollments", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    listFaceEnrollments: () => request<FaceEnrollment[]>("/organizations/me/biometric/enrollments"),
    withdrawFaceEnrollment: (id: string) =>
      request<FaceEnrollmentRecord>(`/organizations/me/biometric/enrollments/${id}/withdraw`, { method: "POST" }),
    addEnrollmentPhoto: (id: string, file: File) => {
      const form = new FormData();
      form.append("image", file);
      return requestForm<AddEnrollmentPhotoResult>(`/organizations/me/biometric/enrollments/${id}/photo`, form);
    },

    // Camera capture + face matching (Phase 6 slice 6c).
    createCamera: (input: CreateCameraInput) =>
      request<CameraRecord>("/organizations/me/cameras", { method: "POST", body: JSON.stringify(input) }),
    listCameras: () => request<CameraRecord[]>("/organizations/me/cameras"),
    // Doubles as the plan's "simulated camera source" — any image
    // posted here exercises the full capture→match pipeline, the same
    // way a real camera adapter eventually will (slice 6e).
    ingestCameraEvent: (cameraId: string, file: File) => {
      const form = new FormData();
      form.append("image", file);
      return requestForm<CameraEventResult>(`/organizations/me/cameras/${cameraId}/events`, form);
    },
    listFaceMatchEvents: () => request<FaceMatchEvent[]>("/organizations/me/face-match-events"),
    reviewFaceMatch: (id: string, input: ReviewFaceMatchInput) =>
      request<FaceMatchEventRecord>(`/organizations/me/face-match-events/${id}/review`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    getFaceMatchImage: (id: string) => requestBlob(`/organizations/me/face-match-events/${id}/image`),

    // Finance (Phase 7 slice 7a-1).
    createFeeCategory: (input: CreateFeeCategoryInput) =>
      request<FeeCategoryRecord>("/organizations/me/fee-categories", { method: "POST", body: JSON.stringify(input) }),
    listFeeCategories: () => request<FeeCategoryRecord[]>("/organizations/me/fee-categories"),
    updateFeeCategory: (id: string, input: UpdateFeeCategoryInput) =>
      request<FeeCategoryRecord>(`/organizations/me/fee-categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    deleteFeeCategory: (id: string) =>
      request<{ deleted: true }>(`/organizations/me/fee-categories/${id}`, { method: "DELETE" }),
    createFeeStructure: (input: CreateFeeStructureInput) =>
      request<FeeStructureRecord>("/organizations/me/fee-structures", { method: "POST", body: JSON.stringify(input) }),
    listFeeStructures: () => request<FeeStructureRecord[]>("/organizations/me/fee-structures"),
    assignFeeStructure: (id: string, input: AssignFeeStructureInput) =>
      request<InvoiceRecord>(`/organizations/me/fee-structures/${id}/assign`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    assignFeeStructureBulk: (id: string, input: AssignFeeStructureBulkInput) =>
      request<AssignFeeStructureBulkResult>(`/organizations/me/fee-structures/${id}/assign-bulk`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    previewFeeStructureBulk: (id: string) =>
      request<AssignFeeStructureBulkPreview>(`/organizations/me/fee-structures/${id}/assign-bulk/preview`),
    listInvoices: (pagination?: PaginationParams) =>
      request<PaginatedResult<InvoiceListItem>>(`/organizations/me/invoices${paginationQuery(pagination)}`),
    getInvoice: (id: string) => request<InvoiceRecord>(`/organizations/me/invoices/${id}`),
    recordPayment: (invoiceId: string, input: RecordPaymentInput) =>
      request<PaymentRecord>(`/organizations/me/invoices/${invoiceId}/payments`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    // eSewa online payment (Phase 7 slice 7a-2), staff-assisted channel.
    initiateEsewaPayment: (invoiceId: string, input: InitiateEsewaPaymentInput) =>
      request<EsewaFormPayload>(`/organizations/me/invoices/${invoiceId}/esewa/initiate`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    confirmEsewaPayment: (data: string) =>
      request<ConfirmEsewaPaymentResult>("/organizations/me/esewa/verify", {
        method: "POST",
        body: JSON.stringify({ data }),
      }),
    // Self-service edition upgrade (the platform's own revenue) — a
    // genuinely separate payment flow from the eSewa fee-collection
    // methods above, reusing the same real gateway.
    initiateBillingUpgrade: (input: InitiateUpgradeInput) =>
      request<EsewaFormPayload>("/organizations/me/billing/upgrade/initiate", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    confirmBillingUpgrade: (data: string) =>
      request<ConfirmUpgradeResult>("/organizations/me/billing/upgrade/confirm", {
        method: "POST",
        body: JSON.stringify({ data }),
      }),
    // Manual fallback while eSewa checkout is disabled on the billing
    // page — see SubmitUpgradeRequestInput's own doc comment.
    submitUpgradeRequest: (input: SubmitUpgradeRequestInput) =>
      request<SubmitUpgradeRequestResult>("/organizations/me/billing/upgrade-request", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    applyDiscount: (invoiceId: string, input: ApplyDiscountInput) =>
      request<DiscountRecord>(`/organizations/me/invoices/${invoiceId}/discounts`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    issueRefund: (paymentId: string, input: IssueRefundInput) =>
      request<RefundRecord>(`/organizations/me/payments/${paymentId}/refunds`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    listFinancialTransactions: () =>
      request<FinancialTransactionRecord[]>("/organizations/me/financial-transactions"),
    createScholarship: (input: CreateScholarshipInput) =>
      request<ScholarshipRecord>("/organizations/me/scholarships", { method: "POST", body: JSON.stringify(input) }),
    listScholarships: () => request<ScholarshipRecord[]>("/organizations/me/scholarships"),
    updateScholarship: (id: string, input: UpdateScholarshipInput) =>
      request<ScholarshipRecord>(`/organizations/me/scholarships/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    deleteScholarship: (id: string) =>
      request<{ deleted: true }>(`/organizations/me/scholarships/${id}`, { method: "DELETE" }),
    assignScholarship: (studentId: string, input: AssignScholarshipInput) =>
      request<StudentScholarshipRecord>(`/organizations/me/students/${studentId}/scholarships`, {
        method: "POST",
        body: JSON.stringify(input),
      }),

    // Roles & Permissions admin.
    listRoles: () => request<RoleRecord[]>("/organizations/me/roles"),
    createRole: (input: CreateRoleInput) =>
      request<RoleRecord>("/organizations/me/roles", { method: "POST", body: JSON.stringify(input) }),
    updateRole: (id: string, input: UpdateRoleInput) =>
      request<RoleRecord>(`/organizations/me/roles/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    deleteRole: (id: string) => request<{ deleted: true }>(`/organizations/me/roles/${id}`, { method: "DELETE" }),
    listPermissions: () => request<PermissionRecord[]>("/organizations/me/permissions"),
    listOrgUsers: () => request<UserSummary[]>("/organizations/me/users"),
    assignRole: (userId: string, input: AssignRoleInput) =>
      request<UserRoleAssignment>(`/organizations/me/users/${userId}/roles`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    unassignRole: (userId: string, roleId: string) =>
      request<{ unassigned: true }>(`/organizations/me/users/${userId}/roles/${roleId}`, { method: "DELETE" }),
    listAuditLogs: (params: { resource?: string; action?: string; limit?: number } = {}) => {
      const q = new URLSearchParams();
      if (params.resource) q.set("resource", params.resource);
      if (params.action) q.set("action", params.action);
      if (params.limit != null) q.set("limit", String(params.limit));
      const qs = q.toString();
      return request<AuditLogRecord[]>(`/organizations/me/audit-logs${qs ? `?${qs}` : ""}`);
    },

    // HR & Payroll, part 1: Leave Management (Phase 7 slice 7b-1).
    createLeaveType: (input: CreateLeaveTypeInput) =>
      request<LeaveTypeRecord>("/organizations/me/leave-types", { method: "POST", body: JSON.stringify(input) }),
    listLeaveTypes: () => request<LeaveTypeRecord[]>("/organizations/me/leave-types"),
    updateLeaveType: (id: string, input: UpdateLeaveTypeInput) =>
      request<LeaveTypeRecord>(`/organizations/me/leave-types/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    deleteLeaveType: (id: string) =>
      request<{ deleted: true }>(`/organizations/me/leave-types/${id}`, { method: "DELETE" }),
    allocateLeaveBalance: (input: AllocateLeaveBalanceInput) =>
      request<StaffLeaveBalanceRecord>("/organizations/me/leave-balances", { method: "POST", body: JSON.stringify(input) }),
    listEmployeeLeaveBalances: (employeeId: string) =>
      request<StaffLeaveBalanceRecord[]>(`/organizations/me/employees/${employeeId}/leave-balances`),
    listLeaveRequests: (params: { employeeId?: string; status?: LeaveRequestStatus } = {}) => {
      const q = new URLSearchParams();
      if (params.employeeId) q.set("employeeId", params.employeeId);
      if (params.status) q.set("status", params.status);
      const qs = q.toString();
      return request<LeaveRequestRecord[]>(`/organizations/me/leave-requests${qs ? `?${qs}` : ""}`);
    },
    createLeaveRequest: (input: CreateLeaveRequestInput) =>
      request<LeaveRequestRecord>("/organizations/me/leave-requests", { method: "POST", body: JSON.stringify(input) }),
    approveLeaveRequest: (id: string) =>
      request<LeaveRequestRecord>(`/organizations/me/leave-requests/${id}/approve`, { method: "POST" }),
    rejectLeaveRequest: (id: string, input: ReviewLeaveRequestInput = {}) =>
      request<LeaveRequestRecord>(`/organizations/me/leave-requests/${id}/reject`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    cancelLeaveRequest: (id: string) =>
      request<LeaveRequestRecord>(`/organizations/me/leave-requests/${id}/cancel`, { method: "POST" }),

    // HR & Payroll, part 2: Payroll (Phase 7 slice 7b-2).
    createSalaryStructure: (input: CreateSalaryStructureInput) =>
      request<SalaryStructureRecord>("/organizations/me/salary-structures", { method: "POST", body: JSON.stringify(input) }),
    listSalaryStructures: () => request<SalaryStructureRecord[]>("/organizations/me/salary-structures"),
    addSalaryStructureItem: (structureId: string, input: SalaryStructureItemInput) =>
      request(`/organizations/me/salary-structures/${structureId}/items`, { method: "POST", body: JSON.stringify(input) }),
    removeSalaryStructureItem: (structureId: string, itemId: string) =>
      request(`/organizations/me/salary-structures/${structureId}/items/${itemId}`, { method: "DELETE" }),
    assignSalaryStructure: (employeeId: string, salaryStructureId: string) =>
      request(`/organizations/me/employees/${employeeId}/salary-structure`, {
        method: "POST",
        body: JSON.stringify({ salaryStructureId }),
      }),
    unassignSalaryStructure: (employeeId: string) =>
      request(`/organizations/me/employees/${employeeId}/salary-structure`, { method: "DELETE" }),
    generatePayroll: (input: GeneratePayrollInput) =>
      request<GeneratePayrollResult>("/organizations/me/payroll/generate", { method: "POST", body: JSON.stringify(input) }),
    previewPayrollGeneration: (input: GeneratePayrollInput) =>
      request<PayrollGenerationPreview>("/organizations/me/payroll/generate/preview", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    listPayroll: (
      params: { employeeId?: string; periodMonth?: number; periodYear?: number; status?: PayrollStatus } = {},
    ) => {
      const q = new URLSearchParams();
      if (params.employeeId) q.set("employeeId", params.employeeId);
      if (params.periodMonth != null) q.set("periodMonth", String(params.periodMonth));
      if (params.periodYear != null) q.set("periodYear", String(params.periodYear));
      if (params.status) q.set("status", params.status);
      const qs = q.toString();
      return request<PayrollRecord[]>(`/organizations/me/payroll${qs ? `?${qs}` : ""}`);
    },
    getPayroll: (id: string) => request<PayrollRecord>(`/organizations/me/payroll/${id}`),
    addPayrollItem: (id: string, input: AddPayrollItemInput) =>
      request(`/organizations/me/payroll/${id}/items`, { method: "POST", body: JSON.stringify(input) }),
    removePayrollItem: (id: string, itemId: string) =>
      request(`/organizations/me/payroll/${id}/items/${itemId}`, { method: "DELETE" }),
    finalizePayroll: (id: string) =>
      request<PayrollRecord>(`/organizations/me/payroll/${id}/finalize`, { method: "POST" }),
    markPayrollPaid: (id: string, input: MarkPayrollPaidInput) =>
      request<PayrollRecord>(`/organizations/me/payroll/${id}/pay`, { method: "POST", body: JSON.stringify(input) }),
    cancelPayroll: (id: string) =>
      request<PayrollRecord>(`/organizations/me/payroll/${id}/cancel`, { method: "POST" }),

    // Transport, part 1: core roster (Phase 7 slice 7d-1).
    createVehicle: (input: CreateVehicleInput) =>
      request<VehicleRecord>("/organizations/me/vehicles", { method: "POST", body: JSON.stringify(input) }),
    listVehicles: () => request<VehicleRecord[]>("/organizations/me/vehicles"),
    updateVehicle: (id: string, input: UpdateVehicleInput) =>
      request<VehicleRecord>(`/organizations/me/vehicles/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    deleteVehicle: (id: string) =>
      request<{ deleted: true }>(`/organizations/me/vehicles/${id}`, { method: "DELETE" }),
    createDriver: (input: CreateDriverInput) =>
      request<DriverRecord>("/organizations/me/drivers", { method: "POST", body: JSON.stringify(input) }),
    listDrivers: () => request<DriverRecord[]>("/organizations/me/drivers"),
    updateDriver: (id: string, input: UpdateDriverInput) =>
      request<DriverRecord>(`/organizations/me/drivers/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    deleteDriver: (id: string) =>
      request<{ deleted: true }>(`/organizations/me/drivers/${id}`, { method: "DELETE" }),
    createRoute: (input: CreateRouteInput) =>
      request<RouteRecord>("/organizations/me/routes", { method: "POST", body: JSON.stringify(input) }),
    listRoutes: () => request<RouteRecord[]>("/organizations/me/routes"),
    updateRoute: (id: string, input: UpdateRouteInput) =>
      request<RouteRecord>(`/organizations/me/routes/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    addStop: (routeId: string, input: AddStopInput) =>
      request<StopRecord>(`/organizations/me/routes/${routeId}/stops`, { method: "POST", body: JSON.stringify(input) }),
    removeStop: (routeId: string, stopId: string) =>
      request(`/organizations/me/routes/${routeId}/stops/${stopId}`, { method: "DELETE" }),
    assignStudentTransport: (input: AssignStudentTransportInput) =>
      request<StudentTransportAssignmentRecord>("/organizations/me/student-transport-assignments", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    listStudentTransportAssignments: () =>
      request<StudentTransportAssignmentRecord[]>("/organizations/me/student-transport-assignments"),
    unassignStudentTransport: (studentEnrollmentId: string) =>
      request(`/organizations/me/student-transport-assignments/${studentEnrollmentId}`, { method: "DELETE" }),

    // Transport, part 2: driver location + navigation (Phase 7 slice 7d-2).
    getLatestTracking: (vehicleId: string) =>
      request<VehicleTrackingEventRecord | null>(`/organizations/me/vehicles/${vehicleId}/tracking/latest`),
    listLatestTrackingByVehicle: () =>
      request<VehicleTrackingEventWithVehicle[]>("/organizations/me/vehicles/tracking/latest"),

    // Driver self-service portal — mirrors the student-portal pattern,
    // JwtAuthGuard-only endpoints, the driver's identity is derived
    // server-side from the caller's own token.
    getDriverPortalMe: () => request<DriverPortalMe>("/organizations/me/driver-portal/me"),
    submitDriverTracking: (input: SubmitTrackingInput) =>
      request<VehicleTrackingEventRecord>("/organizations/me/driver-portal/tracking", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    // Teacher self-service portal — same JwtAuthGuard-only pattern,
    // identity derived server-side from the caller's own token.
    getTeacherPortalMe: () => request<TeacherPortalMe>("/organizations/me/teacher-portal/me"),
    teacherClassesToday: (date: string) =>
      request<TeacherPortalClassToday[]>(`/organizations/me/teacher-portal/today?date=${encodeURIComponent(date)}`),
    createTeacherClassSession: (input: CreateClassSessionInput) =>
      request<ClassSession>("/organizations/me/teacher-portal/class-sessions", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    getTeacherClassSession: (sessionId: string) =>
      request<ClassSession>(`/organizations/me/teacher-portal/class-sessions/${sessionId}`),
    recordTeacherProgress: (sessionId: string, input: RecordProgressInput) =>
      request<ClassSession>(`/organizations/me/teacher-portal/class-sessions/${sessionId}/progress`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    addTeacherClassMaterial: (sessionId: string, input: CreateClassMaterialInput) =>
      request<ClassMaterial>(`/organizations/me/teacher-portal/class-sessions/${sessionId}/materials`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    completeTeacherClassSession: (sessionId: string) =>
      request<ClassSession>(`/organizations/me/teacher-portal/class-sessions/${sessionId}/complete`, {
        method: "POST",
      }),
    getTeacherSyllabusNodes: (sessionId: string) =>
      request<TeacherPortalSyllabusNode[]>(`/organizations/me/teacher-portal/class-sessions/${sessionId}/syllabus-nodes`),

    // Course modules & content — teacher self-service side.
    listTeacherModules: (teachingAssignmentId: string) =>
      request<CourseModuleRecord[]>(
        `/organizations/me/teacher-portal/modules?teachingAssignmentId=${encodeURIComponent(teachingAssignmentId)}`,
      ),
    createCourseModule: (input: CreateCourseModuleInput) =>
      request<CourseModuleRecord>("/organizations/me/teacher-portal/modules", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    updateCourseModule: (moduleId: string, input: UpdateCourseModuleInput) =>
      request<CourseModuleRecord>(`/organizations/me/teacher-portal/modules/${moduleId}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    addCourseModuleItem: (moduleId: string, input: CreateCourseModuleItemInput) =>
      request<CourseModuleItemRecord>(`/organizations/me/teacher-portal/modules/${moduleId}/items`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    updateCourseModuleItem: (itemId: string, input: UpdateCourseModuleItemInput) =>
      request<CourseModuleItemRecord>(`/organizations/me/teacher-portal/module-items/${itemId}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),

    // Course modules & content — student self-service side.
    listStudentCourses: () => request<StudentPortalCourse[]>("/organizations/me/portal/courses"),
    listStudentModules: (teachingAssignmentId: string) =>
      request<StudentPortalModule[]>(`/organizations/me/portal/courses/${teachingAssignmentId}/modules`),
    completeModuleItem: (itemId: string) =>
      request(`/organizations/me/portal/module-items/${itemId}/complete`, { method: "POST" }),

    // Assignments — teacher self-service side (LMS discovery slice 3).
    listTeacherAssignments: (teachingAssignmentId: string) =>
      request<TeacherPortalAssignmentListItem[]>(
        `/organizations/me/teacher-portal/assignments?teachingAssignmentId=${encodeURIComponent(teachingAssignmentId)}`,
      ),
    createTeacherAssignment: (input: CreateAssignmentInput) =>
      request<Assignment>("/organizations/me/teacher-portal/assignments", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    getTeacherAssignment: (assignmentId: string) =>
      request<Assignment>(`/organizations/me/teacher-portal/assignments/${assignmentId}`),
    updateTeacherAssignment: (assignmentId: string, input: UpdateAssignmentInput) =>
      request<Assignment>(`/organizations/me/teacher-portal/assignments/${assignmentId}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    gradeTeacherSubmission: (assignmentId: string, studentId: string, input: GradeSubmissionInput) =>
      request<AssignmentSubmission>(
        `/organizations/me/teacher-portal/assignments/${assignmentId}/submissions/${studentId}/grade`,
        { method: "PUT", body: JSON.stringify(input) },
      ),

    // Assignments — student self-service side.
    listStudentAssignments: () => request<StudentPortalAssignment[]>("/organizations/me/portal/assignments"),
    getStudentAssignment: (assignmentId: string) =>
      request<StudentPortalAssignment>(`/organizations/me/portal/assignments/${assignmentId}`),
    submitStudentAssignment: (assignmentId: string, input: SubmitAssignmentInput) =>
      request<AssignmentSubmission>(`/organizations/me/portal/assignments/${assignmentId}/submit`, {
        method: "POST",
        body: JSON.stringify(input),
      }),

    // Quizzes — teacher self-service side (LMS discovery slice 4).
    listTeacherQuizzes: (teachingAssignmentId: string) =>
      request<TeacherPortalQuizListItem[]>(
        `/organizations/me/teacher-portal/quizzes?teachingAssignmentId=${encodeURIComponent(teachingAssignmentId)}`,
      ),
    createTeacherQuiz: (input: CreateKnowledgeCheckInput) =>
      request<KnowledgeCheck>("/organizations/me/teacher-portal/quizzes", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    getTeacherQuiz: (checkId: string) => request<KnowledgeCheck>(`/organizations/me/teacher-portal/quizzes/${checkId}`),
    addTeacherQuizQuestion: (checkId: string, input: CreateQuestionInput) =>
      request<KnowledgeCheckQuestion>(`/organizations/me/teacher-portal/quizzes/${checkId}/questions`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    publishTeacherQuiz: (checkId: string) =>
      request<KnowledgeCheck>(`/organizations/me/teacher-portal/quizzes/${checkId}/publish`, { method: "POST" }),

    // Quizzes — student self-service side.
    listStudentQuizzes: () => request<StudentPortalQuiz[]>("/organizations/me/portal/quizzes"),
    getStudentQuiz: (checkId: string) => request<StudentPortalQuiz>(`/organizations/me/portal/quizzes/${checkId}`),
    startStudentQuiz: (checkId: string) =>
      request<QuizAttemptState>(`/organizations/me/portal/quizzes/${checkId}/start`, { method: "POST" }),
    saveStudentQuizAnswer: (checkId: string, questionId: string, input: SaveQuizAnswerInput) =>
      request(`/organizations/me/portal/quizzes/${checkId}/answers/${questionId}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    submitStudentQuiz: (checkId: string) =>
      request<StudentPortalQuiz>(`/organizations/me/portal/quizzes/${checkId}/submit`, { method: "POST" }),

    // Announcements — teacher self-service side (LMS discovery slice 5).
    listTeacherAnnouncements: (teachingAssignmentId: string) =>
      request<Announcement[]>(
        `/organizations/me/teacher-portal/announcements?teachingAssignmentId=${encodeURIComponent(teachingAssignmentId)}`,
      ),
    createTeacherAnnouncement: (input: CreateAnnouncementInput) =>
      request<Announcement>("/organizations/me/teacher-portal/announcements", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    updateTeacherAnnouncement: (announcementId: string, input: UpdateAnnouncementInput) =>
      request<Announcement>(`/organizations/me/teacher-portal/announcements/${announcementId}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),

    // Announcements — student self-service side.
    listStudentAnnouncements: () => request<StudentPortalAnnouncement[]>("/organizations/me/portal/announcements"),

    // Discussions — teacher self-service side (LMS discovery slice 6).
    listTeacherDiscussionTopics: (teachingAssignmentId: string) =>
      request<DiscussionTopic[]>(
        `/organizations/me/teacher-portal/discussion-topics?teachingAssignmentId=${encodeURIComponent(teachingAssignmentId)}`,
      ),
    createTeacherDiscussionTopic: (input: CreateDiscussionTopicInput) =>
      request<DiscussionTopic>("/organizations/me/teacher-portal/discussion-topics", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    getTeacherDiscussionTopic: (topicId: string) =>
      request<DiscussionTopicWithPosts>(`/organizations/me/teacher-portal/discussion-topics/${topicId}`),
    updateTeacherDiscussionTopic: (topicId: string, input: UpdateDiscussionTopicInput) =>
      request<DiscussionTopic>(`/organizations/me/teacher-portal/discussion-topics/${topicId}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    createTeacherDiscussionPost: (topicId: string, input: CreateDiscussionPostInput) =>
      request<DiscussionPost>(`/organizations/me/teacher-portal/discussion-topics/${topicId}/posts`, {
        method: "POST",
        body: JSON.stringify(input),
      }),

    // Discussions — student self-service side.
    listStudentDiscussionTopics: () =>
      request<StudentPortalDiscussionTopic[]>("/organizations/me/portal/discussion-topics"),
    getStudentDiscussionTopic: (topicId: string) =>
      request<DiscussionTopicWithPosts>(`/organizations/me/portal/discussion-topics/${topicId}`),
    createStudentDiscussionPost: (topicId: string, input: CreateDiscussionPostInput) =>
      request<DiscussionPost>(`/organizations/me/portal/discussion-topics/${topicId}/posts`, {
        method: "POST",
        body: JSON.stringify(input),
      }),

    // Documents & Certificates self-service (Phase 7h)
    listOwnDocuments: () => request<StudentDocumentRecord[]>("/organizations/me/portal/documents"),
    uploadOwnDocument: (input: UploadOwnDocumentInput) =>
      request<StudentDocumentRecord>("/organizations/me/portal/documents", { method: "POST", body: JSON.stringify(input) }),
    listOwnCertificates: () => request<CertificateRecord[]>("/organizations/me/portal/certificates"),

    // Gradebook (LMS discovery slice 7) — the only new endpoint; the
    // rest of the grid is built client-side from listTeacherAssignments/
    // listTeacherQuizzes' existing submissions/attempts data.
    getTeacherCourseRoster: (teachingAssignmentId: string) =>
      request<Student[]>(`/organizations/me/teacher-portal/courses/${teachingAssignmentId}/roster`),

    // Hostel (Phase 7 slice 7e) — no fee/payment methods here
    // deliberately; hostel billing reuses listFeeStructures/
    // assignFeeStructure above as-is.
    createHostel: (input: CreateHostelInput) =>
      request<HostelRecord>("/organizations/me/hostels", { method: "POST", body: JSON.stringify(input) }),
    listHostels: () => request<HostelRecord[]>("/organizations/me/hostels"),
    createHostelBuilding: (input: CreateHostelBuildingInput) =>
      request<HostelBuildingRecord>("/organizations/me/hostel-buildings", { method: "POST", body: JSON.stringify(input) }),
    createHostelRoom: (input: CreateHostelRoomInput) =>
      request<HostelRoomRecord>("/organizations/me/hostel-rooms", { method: "POST", body: JSON.stringify(input) }),
    createHostelBed: (input: CreateHostelBedInput) =>
      request<HostelBedRecord>("/organizations/me/hostel-beds", { method: "POST", body: JSON.stringify(input) }),
    listVacantHostelBeds: () => request<VacantHostelBedRecord[]>("/organizations/me/hostel-beds/vacant"),
    updateHostelBed: (bedId: string, input: UpdateHostelBedInput) =>
      request<HostelBedRecord>(`/organizations/me/hostel-beds/${bedId}`, { method: "PATCH", body: JSON.stringify(input) }),
    allocateHostelBed: (input: AllocateHostelBedInput) =>
      request<HostelAllocationRecord>("/organizations/me/hostel-allocations", { method: "POST", body: JSON.stringify(input) }),
    listHostelAllocations: () => request<HostelAllocationRecord[]>("/organizations/me/hostel-allocations"),
    unallocateHostelBed: (studentEnrollmentId: string) =>
      request(`/organizations/me/hostel-allocations/${studentEnrollmentId}`, { method: "DELETE" }),
    markHostelAttendance: (allocationId: string, input: MarkHostelAttendanceInput) =>
      request<HostelAttendanceRecord>(`/organizations/me/hostel-allocations/${allocationId}/attendance`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    listHostelAttendance: (allocationId: string) =>
      request<HostelAttendanceRecord[]>(`/organizations/me/hostel-allocations/${allocationId}/attendance`),
    logHostelVisitorIn: (allocationId: string, input: LogHostelVisitorInput) =>
      request<HostelVisitorRecord>(`/organizations/me/hostel-allocations/${allocationId}/visitors`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    logHostelVisitorOut: (visitorId: string) =>
      request<HostelVisitorRecord>(`/organizations/me/hostel-visitors/${visitorId}/checkout`, { method: "PATCH" }),
    listHostelVisitors: (allocationId: string) =>
      request<HostelVisitorRecord[]>(`/organizations/me/hostel-allocations/${allocationId}/visitors`),
    createHostelComplaint: (allocationId: string, input: CreateHostelComplaintInput) =>
      request<HostelComplaintRecord>(`/organizations/me/hostel-allocations/${allocationId}/complaints`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    listHostelComplaints: () => request<HostelComplaintRecord[]>("/organizations/me/hostel-complaints"),
    updateHostelComplaint: (complaintId: string, input: UpdateHostelComplaintInput) =>
      request<HostelComplaintRecord>(`/organizations/me/hostel-complaints/${complaintId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    createHostelMaintenanceRequest: (input: CreateHostelMaintenanceRequestInput) =>
      request<HostelMaintenanceRequestRecord>("/organizations/me/hostel-maintenance", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    listHostelMaintenanceRequests: () => request<HostelMaintenanceRequestRecord[]>("/organizations/me/hostel-maintenance"),
    updateHostelMaintenanceRequest: (requestId: string, input: UpdateHostelMaintenanceRequestInput) =>
      request<HostelMaintenanceRequestRecord>(`/organizations/me/hostel-maintenance/${requestId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    createHostelLookup: (input: CreateHostelLookupInput) =>
      request<HostelLookupRecord>("/organizations/me/hostel-lookups", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    updateHostelLookup: (id: string, input: UpdateHostelLookupInput) =>
      request<HostelLookupRecord>(`/organizations/me/hostel-lookups/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    deleteHostelLookup: (id: string) =>
      request<{ deleted: true }>(`/organizations/me/hostel-lookups/${id}`, { method: "DELETE" }),
    listHostelLookups: (kind?: HostelLookupKind) =>
      request<HostelLookupRecord[]>(`/organizations/me/hostel-lookups${kind ? `?kind=${kind}` : ""}`),

    // Inventory (Phase 7 slice 7f)
    createInventoryCategory: (input: CreateInventoryCategoryInput) =>
      request<InventoryCategoryRecord>("/organizations/me/inventory-categories", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    listInventoryCategories: () => request<InventoryCategoryRecord[]>("/organizations/me/inventory-categories"),
    updateInventoryCategory: (id: string, input: UpdateInventoryCategoryInput) =>
      request<InventoryCategoryRecord>(`/organizations/me/inventory-categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    deleteInventoryCategory: (id: string) =>
      request<{ deleted: true }>(`/organizations/me/inventory-categories/${id}`, { method: "DELETE" }),
    createSupplier: (input: CreateSupplierInput) =>
      request<SupplierRecord>("/organizations/me/suppliers", { method: "POST", body: JSON.stringify(input) }),
    listSuppliers: () => request<SupplierRecord[]>("/organizations/me/suppliers"),
    updateSupplier: (id: string, input: UpdateSupplierInput) =>
      request<SupplierRecord>(`/organizations/me/suppliers/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    deleteSupplier: (id: string) =>
      request<{ deleted: true }>(`/organizations/me/suppliers/${id}`, { method: "DELETE" }),
    createInventoryItem: (input: CreateInventoryItemInput) =>
      request<InventoryItemRecord>("/organizations/me/inventory-items", { method: "POST", body: JSON.stringify(input) }),
    listInventoryItems: () => request<InventoryItemRecord[]>("/organizations/me/inventory-items"),
    createPurchaseOrder: (input: CreatePurchaseOrderInput) =>
      request<PurchaseOrderRecord>("/organizations/me/purchase-orders", { method: "POST", body: JSON.stringify(input) }),
    listPurchaseOrders: () => request<PurchaseOrderRecord[]>("/organizations/me/purchase-orders"),
    addPurchaseOrderItem: (purchaseOrderId: string, input: AddPurchaseOrderItemInput) =>
      request<PurchaseOrderItemRecord>(`/organizations/me/purchase-orders/${purchaseOrderId}/items`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    placePurchaseOrder: (purchaseOrderId: string) =>
      request<PurchaseOrderRecord>(`/organizations/me/purchase-orders/${purchaseOrderId}/place`, { method: "POST" }),
    receivePurchaseOrder: (purchaseOrderId: string, input: ReceivePurchaseOrderInput) =>
      request<PurchaseOrderRecord>(`/organizations/me/purchase-orders/${purchaseOrderId}/receive`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    cancelPurchaseOrder: (purchaseOrderId: string) =>
      request<PurchaseOrderRecord>(`/organizations/me/purchase-orders/${purchaseOrderId}/cancel`, { method: "POST" }),
    createStockAdjustment: (input: CreateStockAdjustmentInput) =>
      request<StockMovementRecord>("/organizations/me/stock-movements", { method: "POST", body: JSON.stringify(input) }),
    listStockMovements: (itemId?: string) =>
      request<StockMovementRecord[]>(`/organizations/me/stock-movements${itemId ? `?itemId=${itemId}` : ""}`),
    createAsset: (input: CreateAssetInput) =>
      request<AssetRecord>("/organizations/me/assets", { method: "POST", body: JSON.stringify(input) }),
    listAssets: () => request<AssetRecord[]>("/organizations/me/assets"),
    updateAsset: (assetId: string, input: UpdateAssetInput) =>
      request<AssetRecord>(`/organizations/me/assets/${assetId}`, { method: "PATCH", body: JSON.stringify(input) }),
    assignAsset: (input: AssignAssetInput) =>
      request<AssetAssignmentRecord>("/organizations/me/asset-assignments", { method: "POST", body: JSON.stringify(input) }),
    returnAsset: (assignmentId: string) =>
      request<AssetAssignmentRecord>(`/organizations/me/asset-assignments/${assignmentId}/return`, { method: "POST" }),
    listAssetAssignments: (assetId?: string) =>
      request<AssetAssignmentRecord[]>(`/organizations/me/asset-assignments${assetId ? `?assetId=${assetId}` : ""}`),

    // Communication (Phase 7 slice 7g) — org-wide broadcast messaging;
    // announcements/notifications reuse the existing LMS endpoints
    // above, not duplicated here.
    createMessageTemplate: (input: CreateMessageTemplateInput) =>
      request<MessageTemplateRecord>("/organizations/me/message-templates", { method: "POST", body: JSON.stringify(input) }),
    listMessageTemplates: () => request<MessageTemplateRecord[]>("/organizations/me/message-templates"),
    updateMessageTemplate: (id: string, input: UpdateMessageTemplateInput) =>
      request<MessageTemplateRecord>(`/organizations/me/message-templates/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    deleteMessageTemplate: (id: string) =>
      request<{ deleted: true }>(`/organizations/me/message-templates/${id}`, { method: "DELETE" }),
    createMessage: (input: CreateMessageInput) =>
      request<MessageRecord>("/organizations/me/messages", { method: "POST", body: JSON.stringify(input) }),
    listMessages: () => request<MessageRecord[]>("/organizations/me/messages"),
    sendMessage: (messageId: string) => request<MessageRecord>(`/organizations/me/messages/${messageId}/send`, { method: "POST" }),
    previewMessageRecipients: (messageId: string) =>
      request<MessageRecipientPreview>(`/organizations/me/messages/${messageId}/send/preview`),

    // Documents & Certificates (Phase 7h) — admin-facing. Self-service
    // (a student's own documents/certificates) is under the portal
    // methods above.
    createStudentDocument: (input: CreateStudentDocumentInput) =>
      request<StudentDocumentRecord>("/organizations/me/student-documents", { method: "POST", body: JSON.stringify(input) }),
    listStudentDocuments: (studentId?: string) =>
      request<StudentDocumentRecord[]>(`/organizations/me/student-documents${studentId ? `?studentId=${studentId}` : ""}`),
    reviewStudentDocument: (documentId: string, input: ReviewDocumentInput) =>
      request<StudentDocumentRecord>(`/organizations/me/student-documents/${documentId}/review`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    createStaffDocument: (input: CreateStaffDocumentInput) =>
      request<StaffDocumentRecord>("/organizations/me/staff-documents", { method: "POST", body: JSON.stringify(input) }),
    listStaffDocuments: (employeeId?: string) =>
      request<StaffDocumentRecord[]>(`/organizations/me/staff-documents${employeeId ? `?employeeId=${employeeId}` : ""}`),
    reviewStaffDocument: (documentId: string, input: ReviewDocumentInput) =>
      request<StaffDocumentRecord>(`/organizations/me/staff-documents/${documentId}/review`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    createCertificate: (input: CreateCertificateInput) =>
      request<CertificateRecord>("/organizations/me/certificates", { method: "POST", body: JSON.stringify(input) }),
    listCertificates: (studentId?: string) =>
      request<CertificateRecord[]>(`/organizations/me/certificates${studentId ? `?studentId=${studentId}` : ""}`),
    revokeCertificate: (certificateId: string, input: RevokeCertificateInput) =>
      request<CertificateRecord>(`/organizations/me/certificates/${certificateId}/revoke`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    // Public verification — the backend route has no auth guard at
    // all, so this works whether or not the caller happens to be
    // logged in; request() only ever *adds* an Authorization header
    // when a token is available, never requires one.
    verifyCertificate: (code: string) => request<PublicCertificateVerification>(`/verify/certificates/${code}`),

    // Alumni & Career, part 1 (Phase 8 slice 8a) — admin-facing.
    // Self-service (an alumnus's own profile) is under the portal
    // methods above.
    createAlumniProfile: (input: CreateAlumniProfileInput) =>
      request<AlumniProfileRecord>("/organizations/me/alumni-profiles", { method: "POST", body: JSON.stringify(input) }),
    listAlumniProfiles: () => request<AlumniProfileRecord[]>("/organizations/me/alumni-profiles"),
    getAlumniProfile: (id: string) => request<AlumniProfileRecord>(`/organizations/me/alumni-profiles/${id}`),
    updateAlumniProfile: (id: string, input: UpdateAlumniProfileInput) =>
      request<AlumniProfileRecord>(`/organizations/me/alumni-profiles/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    createAlumniCompany: (input: CreateAlumniCompanyInput) =>
      request<AlumniCompanyRecord>("/organizations/me/alumni-companies", { method: "POST", body: JSON.stringify(input) }),
    listAlumniCompanies: () => request<AlumniCompanyRecord[]>("/organizations/me/alumni-companies"),
    addAlumniEducation: (profileId: string, input: CreateAlumniEducationInput) =>
      request<AlumniEducationRecord>(`/organizations/me/alumni-profiles/${profileId}/education`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    removeAlumniEducation: (id: string) =>
      request<AlumniEducationRecord>(`/organizations/me/alumni-education/${id}`, { method: "DELETE" }),
    addAlumniCareerHistory: (profileId: string, input: CreateAlumniCareerHistoryInput) =>
      request<AlumniCareerHistoryRecord>(`/organizations/me/alumni-profiles/${profileId}/career-history`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    updateAlumniCareerHistory: (id: string, input: UpdateAlumniCareerHistoryInput) =>
      request<AlumniCareerHistoryRecord>(`/organizations/me/alumni-career-history/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    removeAlumniCareerHistory: (id: string) =>
      request<AlumniCareerHistoryRecord>(`/organizations/me/alumni-career-history/${id}`, { method: "DELETE" }),
    addAlumniSkill: (profileId: string, input: CreateAlumniSkillInput) =>
      request<AlumniSkillRecord>(`/organizations/me/alumni-profiles/${profileId}/skills`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    removeAlumniSkill: (id: string) => request<AlumniSkillRecord>(`/organizations/me/alumni-skills/${id}`, { method: "DELETE" }),
    addAlumniCertification: (profileId: string, input: CreateAlumniCertificationInput) =>
      request<AlumniCertificationRecord>(`/organizations/me/alumni-profiles/${profileId}/certifications`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    removeAlumniCertification: (id: string) =>
      request<AlumniCertificationRecord>(`/organizations/me/alumni-certifications/${id}`, { method: "DELETE" }),

    // Alumni engagement (Phase 8 slice 8b)
    createAlumniSurvey: (input: CreateAlumniSurveyInput) =>
      request<AlumniSurveyRecord>("/organizations/me/alumni-surveys", { method: "POST", body: JSON.stringify(input) }),
    listAlumniSurveys: () => request<AlumniSurveyRecord[]>("/organizations/me/alumni-surveys"),
    updateAlumniSurvey: (id: string, input: UpdateAlumniSurveyInput) =>
      request<AlumniSurveyRecord>(`/organizations/me/alumni-surveys/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    publishAlumniSurvey: (id: string) =>
      request<AlumniSurveyRecord>(`/organizations/me/alumni-surveys/${id}/publish`, { method: "POST" }),
    closeAlumniSurvey: (id: string) =>
      request<AlumniSurveyRecord>(`/organizations/me/alumni-surveys/${id}/close`, { method: "POST" }),
    listAlumniSurveyResponses: (surveyId: string) =>
      request<AlumniSurveyResponseRecord[]>(`/organizations/me/alumni-surveys/${surveyId}/responses`),
    createAlumniMentorship: (input: CreateAlumniMentorshipInput) =>
      request<AlumniMentorshipRecord>("/organizations/me/alumni-mentorship", { method: "POST", body: JSON.stringify(input) }),
    listAlumniMentorships: () => request<AlumniMentorshipRecord[]>("/organizations/me/alumni-mentorship"),
    respondAlumniMentorship: (id: string, input: RespondAlumniMentorshipInput) =>
      request<AlumniMentorshipRecord>(`/organizations/me/alumni-mentorship/${id}/respond`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    completeAlumniMentorship: (id: string) =>
      request<AlumniMentorshipRecord>(`/organizations/me/alumni-mentorship/${id}/complete`, { method: "POST" }),
    addAlumniAchievement: (profileId: string, input: CreateAlumniAchievementInput) =>
      request<AlumniAchievementRecord>(`/organizations/me/alumni-profiles/${profileId}/achievements`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    removeAlumniAchievement: (id: string) =>
      request<AlumniAchievementRecord>(`/organizations/me/alumni-achievements/${id}`, { method: "DELETE" }),

    // Career services (Phase 8 slice 8c)
    createCareerOpportunity: (input: CreateOpportunityInput) =>
      request<CareerOpportunityRecord>("/organizations/me/career-opportunities", { method: "POST", body: JSON.stringify(input) }),
    listCareerOpportunities: () => request<CareerOpportunityRecord[]>("/organizations/me/career-opportunities"),
    reviewCareerOpportunity: (id: string, input: ReviewOpportunityInput) =>
      request<CareerOpportunityRecord>(`/organizations/me/career-opportunities/${id}/review`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    closeCareerOpportunity: (id: string) =>
      request<CareerOpportunityRecord>(`/organizations/me/career-opportunities/${id}/close`, { method: "POST" }),
    listApplicationsForOpportunity: (opportunityId: string) =>
      request<CareerApplicationRecord[]>(`/organizations/me/career-opportunities/${opportunityId}/applications`),
    updateApplicationStatus: (id: string, input: UpdateApplicationStatusInput) =>
      request<CareerApplicationRecord>(`/organizations/me/career-applications/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    createCareerService: (input: CreateCareerServiceInput) =>
      request<CareerServiceRecord>("/organizations/me/career-services", { method: "POST", body: JSON.stringify(input) }),
    listCareerServices: () => request<CareerServiceRecord[]>("/organizations/me/career-services"),
    updateCareerService: (id: string, input: UpdateCareerServiceInput) =>
      request<CareerServiceRecord>(`/organizations/me/career-services/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    setGraduateOutcome: (profileId: string, input: SetGraduateOutcomeInput) =>
      request<GraduateOutcomeRecord>(`/organizations/me/alumni-profiles/${profileId}/graduate-outcome`, {
        method: "POST",
        body: JSON.stringify(input),
      }),

    // Alumni self-service
    getOwnAlumniProfile: () => request<AlumniProfileRecord>("/organizations/me/portal/alumni-profile"),
    updateOwnAlumniProfile: (input: UpdateAlumniProfileInput) =>
      request<AlumniProfileRecord>("/organizations/me/portal/alumni-profile", { method: "PATCH", body: JSON.stringify(input) }),
    addOwnAlumniEducation: (input: CreateAlumniEducationInput) =>
      request<AlumniEducationRecord>("/organizations/me/portal/alumni-profile/education", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    addOwnAlumniCareerHistory: (input: CreateAlumniCareerHistoryInput) =>
      request<AlumniCareerHistoryRecord>("/organizations/me/portal/alumni-profile/career-history", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    addOwnAlumniSkill: (input: CreateAlumniSkillInput) =>
      request<AlumniSkillRecord>("/organizations/me/portal/alumni-profile/skills", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    addOwnAlumniCertification: (input: CreateAlumniCertificationInput) =>
      request<AlumniCertificationRecord>("/organizations/me/portal/alumni-profile/certifications", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    listOwnAlumniCompanies: () => request<AlumniCompanyRecord[]>("/organizations/me/portal/alumni-companies"),
    listPublishedAlumniSurveys: () => request<AlumniSurveyRecord[]>("/organizations/me/portal/alumni-surveys"),
    submitOwnAlumniSurveyResponse: (surveyId: string, input: SubmitAlumniSurveyResponseInput) =>
      request<AlumniSurveyResponseRecord>(`/organizations/me/portal/alumni-surveys/${surveyId}/responses`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    listOwnMentorshipsAsMentor: () => request<AlumniMentorshipRecord[]>("/organizations/me/portal/mentorships/as-mentor"),
    listOwnMentorshipsAsMentee: () => request<AlumniMentorshipRecord[]>("/organizations/me/portal/mentorships/as-mentee"),
    respondOwnMentorship: (id: string, input: RespondAlumniMentorshipInput) =>
      request<AlumniMentorshipRecord>(`/organizations/me/portal/mentorships/${id}/respond`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    completeOwnMentorship: (id: string) =>
      request<AlumniMentorshipRecord>(`/organizations/me/portal/mentorships/${id}/complete`, { method: "POST" }),
    addOwnAlumniAchievement: (input: CreateAlumniAchievementInput) =>
      request<AlumniAchievementRecord>("/organizations/me/portal/alumni-profile/achievements", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    createOwnCareerOpportunity: (input: CreateOpportunityInput) =>
      request<CareerOpportunityRecord>("/organizations/me/portal/career-opportunities", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    listApprovedCareerOpportunities: () => request<CareerOpportunityRecord[]>("/organizations/me/portal/career-opportunities"),
    applyToCareerOpportunity: (opportunityId: string, input: CreateApplicationInput) =>
      request<CareerApplicationRecord>(`/organizations/me/portal/career-opportunities/${opportunityId}/apply`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    listOwnCareerApplications: () => request<CareerApplicationRecord[]>("/organizations/me/portal/career-applications"),
    withdrawOwnCareerApplication: (id: string) =>
      request<CareerApplicationRecord>(`/organizations/me/portal/career-applications/${id}/withdraw`, { method: "POST" }),
    listActiveCareerServices: () => request<CareerServiceRecord[]>("/organizations/me/portal/career-services"),
    setOwnGraduateOutcome: (input: SetGraduateOutcomeInput) =>
      request<GraduateOutcomeRecord>("/organizations/me/portal/alumni-profile/graduate-outcome", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),

    // Notifications (LMS discovery slice 9) — one shared endpoint set,
    // not split per portal; a notification is for whoever is logged in.
    listNotifications: () => request<Notification[]>("/organizations/me/notifications"),
    markNotificationRead: (notificationId: string) =>
      request<Notification>(`/organizations/me/notifications/${notificationId}/read`, { method: "POST" }),
    markAllNotificationsRead: () =>
      request<{ count: number }>("/organizations/me/notifications/read-all", { method: "POST" }),

    // File uploads (LMS discovery slice 8) — any authenticated user can
    // upload; the caller attaches the returned url to whatever it's
    // actually for (a module item, a class material, an assignment
    // submission) through that thing's own existing endpoint.
    uploadFile: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return requestForm<UploadResult>("/organizations/me/uploads", form);
    },

    // Analytics & Reports (Phase 8 slice 8d, part 1)
    getOperationalAnalytics: () => request<OperationalAnalytics>("/organizations/me/analytics/operational"),
    getAcademicAnalytics: (examId?: string) =>
      request<AcademicAnalytics>(`/organizations/me/analytics/academic${examId ? `?examId=${examId}` : ""}`),
    getAttendanceAnalytics: (from?: string, to?: string) => {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const qs = params.toString();
      return request<AttendanceAnalytics>(`/organizations/me/analytics/attendance${qs ? `?${qs}` : ""}`);
    },
    getEnrollmentAnalytics: () => request<EnrollmentAnalytics>("/organizations/me/analytics/enrollment"),
    exportOperationalAnalytics: (format: AnalyticsExportFormat) =>
      requestBlob(`/organizations/me/analytics/operational/export?format=${format}`),
    exportAcademicAnalytics: (format: AnalyticsExportFormat, examId?: string) =>
      requestBlob(`/organizations/me/analytics/academic/export?format=${format}${examId ? `&examId=${examId}` : ""}`),
    exportAttendanceAnalytics: (format: AnalyticsExportFormat, from?: string, to?: string) => {
      const params = new URLSearchParams({ format });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      return requestBlob(`/organizations/me/analytics/attendance/export?${params.toString()}`);
    },
    exportEnrollmentAnalytics: (format: AnalyticsExportFormat) =>
      requestBlob(`/organizations/me/analytics/enrollment/export?format=${format}`),

    // Analytics & Reports (Phase 8 slice 8d, part 2)
    getFinancialAnalytics: () => request<FinancialAnalytics>("/organizations/me/analytics/financial"),
    getExaminationAnalytics: () => request<ExaminationAnalytics>("/organizations/me/analytics/examination"),
    getContinuousLearningAnalytics: () =>
      request<ContinuousLearningAnalytics>("/organizations/me/analytics/continuous-learning"),
    getAlumniOutcomesAnalytics: () => request<AlumniOutcomesAnalytics>("/organizations/me/analytics/alumni-outcomes"),
    exportFinancialAnalytics: (format: AnalyticsExportFormat) =>
      requestBlob(`/organizations/me/analytics/financial/export?format=${format}`),
    exportExaminationAnalytics: (format: AnalyticsExportFormat) =>
      requestBlob(`/organizations/me/analytics/examination/export?format=${format}`),
    exportContinuousLearningAnalytics: (format: AnalyticsExportFormat) =>
      requestBlob(`/organizations/me/analytics/continuous-learning/export?format=${format}`),
    exportAlumniOutcomesAnalytics: (format: AnalyticsExportFormat) =>
      requestBlob(`/organizations/me/analytics/alumni-outcomes/export?format=${format}`),

    // Global search (Phase 8, part 1 — people only)
    globalSearch: (q: string) => request<SearchResult>(`/organizations/me/search?q=${encodeURIComponent(q)}`),

    // Platform admin console (licensing editions) — a genuinely
    // separate cross-org identity from every method above. Callers
    // construct a second createApiClient instance whose
    // getAccessToken reads the platform session's own storage key,
    // never the tenant one — see apps/web's platform/login page.
    platformLogin: (input: { email: string; password: string; captchaId: string; captchaAnswer: string }) =>
      request<{ admin: PlatformAdminUser; accessToken: string; expiresIn: number }>("/platform/auth/login", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    // 120s, not the default 30s — this scans every org on the platform
    // sequentially server-side (see platform-organizations.service.ts's
    // own comment on why it can't parallelize), so real-world duration
    // grows with however many orgs this environment has accumulated.
    platformListOrganizations: () =>
      request<PlatformOrganizationSummary[]>("/platform/organizations", {}, 120_000),

    platformUpdateOrganization: (organizationId: string, input: UpdateOrganizationInput) =>
      request<PlatformOrganizationSummary>(`/platform/organizations/${organizationId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),

    // Hard delete — the platform admin's "remove a college and every
    // record ever created under it" action. See
    // PlatformOrganizationsService.deleteOrganization's own comment
    // for how this genuinely removes every child record before the
    // college master row, not a partial/soft delete.
    platformDeleteOrganization: (organizationId: string) =>
      request<{ deleted: true; id: string; name: string }>(`/platform/organizations/${organizationId}`, {
        method: "DELETE",
      }),

    // Manual-upgrade-request inbox — see SubmitUpgradeRequestInput's own
    // doc comment for why this exists. 120s, not the default 30s — same
    // reason as platformListOrganizations: this scans every org on the
    // platform in batches server-side.
    platformListUpgradeRequests: () =>
      request<PlatformUpgradeRequestSummary[]>("/platform/organizations/upgrade-requests", {}, 120_000),

    platformResolveUpgradeRequest: (organizationId: string, id: string) =>
      request<{ resolved: true; id: string }>(`/platform/organizations/${organizationId}/upgrade-requests/${id}`, {
        method: "PATCH",
      }),

    // Device Gateway (Phase 8, docx §12) — barcode/RFID/smart-card
    // scan-in, used by apps/device-gateway-client.
    registerGatewayDevice: (input: RegisterGatewayDeviceInput) =>
      request<GatewayDeviceRecord>("/organizations/me/gateway/devices", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    listGatewayDevices: () => request<GatewayDeviceRecord[]>("/organizations/me/gateway/devices"),
    scanGatewayDevice: (deviceId: string, input: GatewayScanInput) =>
      request<GatewayScanResult>(`/organizations/me/gateway/devices/${deviceId}/scan`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    bindGatewayCard: (input: BindGatewayCardInput) =>
      request<GatewayCardBindingRecord>("/organizations/me/gateway/card-bindings", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    listGatewayScanEvents: () => request<GatewayScanEvent[]>("/organizations/me/gateway/scan-events"),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
