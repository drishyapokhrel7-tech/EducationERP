export * from "./types";

import type {
  AcademicYear,
  AttachCurriculumSubjectInput,
  AuthTokens,
  Campus,
  CreateAcademicYearInput,
  CreateCampusInput,
  CreateCurriculumInput,
  CreateDepartmentInput,
  CreateDesignationInput,
  CreateEmployeeInput,
  CreateEmploymentHistoryInput,
  CreateFacultyInput,
  CreateProgramInput,
  CreateQualificationInput,
  CreateSectionInput,
  CreateStaffTypeInput,
  CreateSubjectInput,
  CreateTermInput,
  Curriculum,
  CurriculumSubject,
  Department,
  Designation,
  Employee,
  EmploymentHistory,
  Faculty,
  LoginInput,
  Organization,
  Program,
  Qualification,
  RegisterOrganizationInput,
  SafeUser,
  Section,
  StaffType,
  Subject,
  TeacherProfile,
  Term,
  UpsertTeacherProfileInput,
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
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
