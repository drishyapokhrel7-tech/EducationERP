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
  AssignmentSubmission,
  CreateSubmissionInput,
  GradeSubmissionInput,
  KnowledgeCheck,
  CreateKnowledgeCheckInput,
  KnowledgeCheckQuestion,
  CreateQuestionInput,
  KnowledgeCheckAttempt,
  CreateAttemptInput,
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
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
