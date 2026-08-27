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
  CreateCurriculumInput,
  CreateDepartmentInput,
  CreateDesignationInput,
  CreateEmployeeInput,
  CreateEmploymentHistoryInput,
  CreateEnrollmentInput,
  CreateFacultyInput,
  CreateGuardianInput,
  CreateProgramInput,
  CreateQualificationInput,
  CreateSectionInput,
  CreateStaffTypeInput,
  CreateStudentInput,
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
  UpsertTeacherProfileInput,
  Room,
  CreateRoomInput,
  Period,
  CreatePeriodInput,
  TeachingAssignment,
  CreateTeachingAssignmentInput,
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

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | null | undefined;
}

export function createApiClient({ baseUrl, getAccessToken }: ApiClientOptions) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = getAccessToken?.();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
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
    const res = await fetch(`${baseUrl}${path}`, { method: "POST", body: form, headers });
    const body = await res.json().catch(() => undefined);
    if (!res.ok) throw new ApiError(res.status, body);
    return body as T;
  }

  // The response is a raw CSV file, not JSON — fetched as a Blob so the
  // caller can trigger a normal browser download.
  async function requestBlob(path: string): Promise<Blob> {
    const token = getAccessToken?.();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${path}`, { headers });
    if (!res.ok) {
      const body = await res.json().catch(() => undefined);
      throw new ApiError(res.status, body);
    }
    return res.blob();
  }

  return {
    registerOrganization: (input: RegisterOrganizationInput) =>
      request<{ organization: Organization; user: SafeUser } & AuthTokens>(
        "/auth/register-organization",
        { method: "POST", body: JSON.stringify(input) },
      ),

    login: (input: LoginInput) =>
      request<{ user: SafeUser } & AuthTokens>("/auth/login", {
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

    listCampuses: () => request<Campus[]>("/organizations/me/campuses"),

    createCampus: (input: CreateCampusInput) =>
      request<Campus>("/organizations/me/campuses", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    listFaculties: () => request<Faculty[]>("/organizations/me/faculties"),
    createFaculty: (input: CreateFacultyInput) =>
      request<Faculty>("/organizations/me/faculties", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    listDepartments: () => request<Department[]>("/organizations/me/departments"),
    createDepartment: (input: CreateDepartmentInput) =>
      request<Department>("/organizations/me/departments", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    listPrograms: () => request<Program[]>("/organizations/me/programs"),
    createProgram: (input: CreateProgramInput) =>
      request<Program>("/organizations/me/programs", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    listAcademicYears: () => request<AcademicYear[]>("/organizations/me/academic-years"),
    createAcademicYear: (input: CreateAcademicYearInput) =>
      request<AcademicYear>("/organizations/me/academic-years", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    listTerms: () => request<Term[]>("/organizations/me/terms"),
    createTerm: (input: CreateTermInput) =>
      request<Term>("/organizations/me/terms", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    listSections: () => request<Section[]>("/organizations/me/sections"),
    createSection: (input: CreateSectionInput) =>
      request<Section>("/organizations/me/sections", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    listStaffTypes: () => request<StaffType[]>("/organizations/me/staff-types"),
    createStaffType: (input: CreateStaffTypeInput) =>
      request<StaffType>("/organizations/me/staff-types", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    listDesignations: () => request<Designation[]>("/organizations/me/designations"),
    createDesignation: (input: CreateDesignationInput) =>
      request<Designation>("/organizations/me/designations", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    listEmployees: () => request<Employee[]>("/organizations/me/employees"),
    createEmployee: (input: CreateEmployeeInput) =>
      request<Employee>("/organizations/me/employees", {
        method: "POST",
        body: JSON.stringify(input),
      }),
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

    listCurricula: () => request<Curriculum[]>("/organizations/me/curricula"),
    createCurriculum: (input: CreateCurriculumInput) =>
      request<Curriculum>("/organizations/me/curricula", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    attachCurriculumSubject: (curriculumId: string, input: AttachCurriculumSubjectInput) =>
      request<CurriculumSubject>(`/organizations/me/curricula/${curriculumId}/subjects`, {
        method: "POST",
        body: JSON.stringify(input),
      }),

    listStudents: () => request<Student[]>("/organizations/me/students"),
    createStudent: (input: CreateStudentInput) =>
      request<Student>("/organizations/me/students", {
        method: "POST",
        body: JSON.stringify(input),
      }),
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
    exportStudents: () => requestBlob("/organizations/me/students/export"),

    listRooms: () => request<Room[]>("/organizations/me/rooms"),
    createRoom: (input: CreateRoomInput) =>
      request<Room>("/organizations/me/rooms", { method: "POST", body: JSON.stringify(input) }),

    listPeriods: () => request<Period[]>("/organizations/me/periods"),
    createPeriod: (input: CreatePeriodInput) =>
      request<Period>("/organizations/me/periods", { method: "POST", body: JSON.stringify(input) }),

    listTeachingAssignments: () =>
      request<TeachingAssignment[]>("/organizations/me/teaching-assignments"),
    createTeachingAssignment: (input: CreateTeachingAssignmentInput) =>
      request<TeachingAssignment>("/organizations/me/teaching-assignments", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    listClassSchedules: () => request<ClassSchedule[]>("/organizations/me/class-schedules"),
    createClassSchedule: (input: CreateClassScheduleInput) =>
      request<ClassSchedule>("/organizations/me/class-schedules", {
        method: "POST",
        body: JSON.stringify(input),
      }),

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

    listGradingSchemes: () => request<GradingScheme[]>("/organizations/me/grading-schemes"),
    createGradingScheme: (input: CreateGradingSchemeInput) =>
      request<GradingScheme>("/organizations/me/grading-schemes", { method: "POST", body: JSON.stringify(input) }),

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
    listInvoices: () => request<InvoiceRecord[]>("/organizations/me/invoices"),
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
    createDriver: (input: CreateDriverInput) =>
      request<DriverRecord>("/organizations/me/drivers", { method: "POST", body: JSON.stringify(input) }),
    listDrivers: () => request<DriverRecord[]>("/organizations/me/drivers"),
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
    listHostelLookups: (kind?: HostelLookupKind) =>
      request<HostelLookupRecord[]>(`/organizations/me/hostel-lookups${kind ? `?kind=${kind}` : ""}`),

    // Inventory (Phase 7 slice 7f)
    createInventoryCategory: (input: CreateInventoryCategoryInput) =>
      request<InventoryCategoryRecord>("/organizations/me/inventory-categories", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    listInventoryCategories: () => request<InventoryCategoryRecord[]>("/organizations/me/inventory-categories"),
    createSupplier: (input: CreateSupplierInput) =>
      request<SupplierRecord>("/organizations/me/suppliers", { method: "POST", body: JSON.stringify(input) }),
    listSuppliers: () => request<SupplierRecord[]>("/organizations/me/suppliers"),
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
    createMessage: (input: CreateMessageInput) =>
      request<MessageRecord>("/organizations/me/messages", { method: "POST", body: JSON.stringify(input) }),
    listMessages: () => request<MessageRecord[]>("/organizations/me/messages"),
    sendMessage: (messageId: string) => request<MessageRecord>(`/organizations/me/messages/${messageId}/send`, { method: "POST" }),

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
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
