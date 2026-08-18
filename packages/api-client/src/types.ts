export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export type UserStatus = "ACTIVE" | "SUSPENDED" | "INVITED" | "DEACTIVATED";

export interface SafeUser {
  id: string;
  organizationId: string;
  email: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface Campus {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterOrganizationInput {
  organizationName: string;
  slug: string;
  adminEmail: string;
  adminFirstName: string;
  adminLastName: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface CreateCampusInput {
  name: string;
  code: string;
}

export interface Faculty {
  id: string;
  organizationId: string;
  campusId: string;
  name: string;
  code: string;
}

export interface CreateFacultyInput {
  campusId: string;
  name: string;
  code: string;
}

export interface Department {
  id: string;
  organizationId: string;
  facultyId: string;
  name: string;
  code: string;
}

export interface CreateDepartmentInput {
  facultyId: string;
  name: string;
  code: string;
}

export interface Program {
  id: string;
  organizationId: string;
  departmentId: string;
  name: string;
  code: string;
  level: string | null;
  durationSemesters: number | null;
  creditHours: number | null;
  entranceExam: string | null;
}

export interface CreateProgramInput {
  departmentId: string;
  name: string;
  code: string;
  level?: string;
  durationSemesters?: number;
  creditHours?: number;
  entranceExam?: string;
}

export interface AcademicYear {
  id: string;
  organizationId: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

export interface CreateAcademicYearInput {
  name: string;
  startDate: string;
  endDate: string;
}

export interface Term {
  id: string;
  organizationId: string;
  academicYearId: string;
  name: string;
  code: string;
  sequence: number;
  startDate: string;
  endDate: string;
}

export interface CreateTermInput {
  academicYearId: string;
  name: string;
  code: string;
  sequence: number;
  startDate: string;
  endDate: string;
}

export interface Section {
  id: string;
  organizationId: string;
  programId: string;
  termId: string;
  name: string;
  code: string;
  capacity: number | null;
}

export interface CreateSectionInput {
  programId: string;
  termId: string;
  name: string;
  code: string;
  capacity?: number;
}

export interface StaffType {
  id: string;
  organizationId: string;
  name: string;
  code: string;
}

export interface CreateStaffTypeInput {
  name: string;
  code: string;
}

export interface Designation {
  id: string;
  organizationId: string;
  name: string;
  code: string;
}

export interface CreateDesignationInput {
  name: string;
  code: string;
}

export type EmployeeStatus = "ACTIVE" | "ON_LEAVE" | "SUSPENDED" | "TERMINATED";

export interface Employee {
  id: string;
  organizationId: string;
  userId: string | null;
  staffTypeId: string;
  designationId: string;
  departmentId: string | null;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  dateOfJoining: string;
  status: EmployeeStatus;
  staffType?: StaffType;
  designation?: Designation;
  department?: Department | null;
}

export interface CreateEmployeeInput {
  staffTypeId: string;
  designationId: string;
  departmentId?: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfJoining: string;
}

export interface EmploymentHistory {
  id: string;
  organizationId: string;
  employeeId: string;
  designationId: string;
  departmentId: string | null;
  startDate: string;
  endDate: string | null;
  reason: string | null;
}

export interface CreateEmploymentHistoryInput {
  designationId: string;
  departmentId?: string;
  startDate: string;
  endDate?: string;
  reason?: string;
}

export interface Qualification {
  id: string;
  organizationId: string;
  employeeId: string;
  degree: string;
  institution: string;
  yearCompleted: number | null;
}

export interface CreateQualificationInput {
  degree: string;
  institution: string;
  yearCompleted?: number;
}

export interface TeacherProfile {
  id: string;
  organizationId: string;
  employeeId: string;
  bio: string | null;
  specialization: string | null;
}

export interface UpsertTeacherProfileInput {
  bio?: string;
  specialization?: string;
}

export interface Subject {
  id: string;
  organizationId: string;
  name: string;
  code: string;
}

export interface CreateSubjectInput {
  name: string;
  code: string;
}

export interface CurriculumSubject {
  id: string;
  curriculumId: string;
  subjectId: string;
  isCompulsory: boolean;
  subject: Subject;
}

export interface Curriculum {
  id: string;
  organizationId: string;
  programId: string;
  name: string;
  code: string;
  subjects: CurriculumSubject[];
}

export interface CreateCurriculumInput {
  programId: string;
  name: string;
  code: string;
}

export interface AttachCurriculumSubjectInput {
  subjectId: string;
  isCompulsory?: boolean;
}

export type StudentStatus = "ACTIVE" | "INACTIVE" | "GRADUATED" | "TRANSFERRED" | "WITHDRAWN";

export interface Guardian {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  occupation: string | null;
}

export interface CreateGuardianInput {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  occupation?: string;
}

export interface StudentGuardian {
  id: string;
  studentId: string;
  guardianId: string;
  relationship: string;
  isPrimaryContact: boolean;
  guardian: Guardian;
}

export interface AttachGuardianInput {
  guardianId: string;
  relationship: string;
  isPrimaryContact?: boolean;
}

export interface Student {
  id: string;
  organizationId: string;
  userId: string | null;
  studentCode: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string | null;
  status: StudentStatus;
  guardians: StudentGuardian[];
}

export interface CreateStudentInput {
  studentCode: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender?: string;
}

export type EnrollmentStatus = "ACTIVE" | "COMPLETED" | "WITHDRAWN";

export interface StudentEnrollment {
  id: string;
  studentId: string;
  programId: string;
  sectionId: string;
  termId: string;
  enrollmentDate: string;
  status: EnrollmentStatus;
  program: Program;
  section: Section;
  term: Term;
}

export interface CreateEnrollmentInput {
  programId: string;
  sectionId: string;
  termId: string;
  enrollmentDate: string;
}

export interface StudentStatusHistoryEntry {
  id: string;
  studentId: string;
  status: StudentStatus;
  reason: string | null;
  effectiveDate: string;
}

export interface UpdateStudentStatusInput {
  status: StudentStatus;
  reason?: string;
  effectiveDate: string;
}

export type AdmissionStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "INTERVIEW_SCHEDULED"
  | "APPROVED"
  | "REJECTED"
  | "ENROLLED";

export interface AdmissionApplication {
  id: string;
  organizationId: string;
  programId: string;
  applicantFirstName: string;
  applicantLastName: string;
  dateOfBirth: string;
  gender: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  appliedDate: string;
  status: AdmissionStatus;
  score: number | null;
  notes: string | null;
  enrolledStudentId: string | null;
  program: Program;
}

export interface CreateAdmissionApplicationInput {
  programId: string;
  applicantFirstName: string;
  applicantLastName: string;
  dateOfBirth: string;
  gender?: string;
  guardianName?: string;
  guardianPhone?: string;
  appliedDate: string;
  score?: number;
  notes?: string;
}

export interface AdmissionStatusHistoryEntry {
  id: string;
  applicationId: string;
  status: AdmissionStatus;
  reason: string | null;
  effectiveDate: string;
}

export interface UpdateAdmissionStatusInput {
  status: Exclude<AdmissionStatus, "ENROLLED">;
  reason?: string;
  effectiveDate: string;
}

export interface EnrollApplicationInput {
  studentCode: string;
  sectionId: string;
  termId: string;
  enrollmentDate: string;
}

export interface ImportRowError {
  row: number;
  message: string;
}

export interface ImportResult {
  totalRows: number;
  created: number;
  errors: ImportRowError[];
}

export interface Room {
  id: string;
  organizationId: string;
  campusId: string;
  name: string;
  code: string;
  capacity: number | null;
  roomType: string | null;
}

export interface CreateRoomInput {
  campusId: string;
  name: string;
  code: string;
  capacity?: number;
  roomType?: string;
}

export interface Period {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  sequence: number;
  startTime: string;
  endTime: string;
}

export interface CreatePeriodInput {
  name: string;
  code: string;
  sequence: number;
  startTime: string;
  endTime: string;
}

export interface TeachingAssignment {
  id: string;
  organizationId: string;
  employeeId: string;
  subjectId: string;
  sectionId: string;
  termId: string;
  employee: Employee;
  subject: Subject;
  section: Section;
  term: Term;
}

export interface CreateTeachingAssignmentInput {
  employeeId: string;
  subjectId: string;
  sectionId: string;
  termId: string;
}

export interface ClassSchedule {
  id: string;
  organizationId: string;
  termId: string;
  teachingAssignmentId: string;
  sectionId: string;
  teacherId: string;
  roomId: string;
  periodId: string;
  dayOfWeek: number;
  room: Room;
  period: Period;
  section: Section;
  teacher: Employee;
  teachingAssignment: TeachingAssignment & { subject: Subject };
}

export interface CreateClassScheduleInput {
  teachingAssignmentId: string;
  roomId: string;
  periodId: string;
  dayOfWeek: number;
}
