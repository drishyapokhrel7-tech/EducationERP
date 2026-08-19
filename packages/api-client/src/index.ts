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
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
