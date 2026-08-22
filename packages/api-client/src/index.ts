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
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
