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
  // Set for self-service logins that aren't email-based (students log
  // in by student code, staff similarly) — this was already returned
  // by the backend (toSafeUser only strips passwordHash) but missing
  // from this type. The user's actual login identifier is
  // `username ?? email`, not `id` (a DB primary key, never typed
  // anywhere).
  username: string | null;
  firstName: string;
  lastName: string;
  status: UserStatus;
  // Null = not verified. A non-blocking, after-the-fact confirmation,
  // not a login gate — see RegisterOrganizationResult.emailVerification.
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// No real email provider exists in this project — the code is
// returned directly here and shown on-screen, not emailed. Confirming
// it back only proves the user can read what's already on their own
// screen, not that they own the email address.
export interface EmailVerificationChallenge {
  codeId: string;
  code: string;
}

// Email-only now — `code` is only ever populated under NODE_ENV=test
// (the e2e suite's own escape hatch); real callers get `codeId` alone
// and must check their email. See PasswordResetService's own comment
// for the full reasoning.
export interface PasswordResetChallenge {
  codeId: string;
  code?: string;
}

// POST auth/me's shape — the JWT payload itself. SafeUser (the object
// stored in the session) has no roles field, so the user-profile
// popup fetches this separately to show "Role".
export interface CurrentUserInfo {
  sub: string;
  organizationId: string;
  roles: string[];
  permissions: string[];
}

export type Edition = "FREE" | "PROFESSIONAL" | "ULTRA";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  edition: Edition;
  createdAt: string;
  updatedAt: string;
}

export interface EditionStatus {
  edition: Edition;
  // Null = no expiry (FREE, or a paid edition the platform admin set
  // manually rather than via a real payment). `edition` here is
  // already the *effective* edition — if a paid edition's
  // editionExpiresAt has passed, the server reports FREE even though
  // nothing was written back to the database (see
  // effectiveEdition() in the backend's edition-limits.ts).
  editionExpiresAt: string | null;
  studentCount: number;
  employeeCount: number;
  limit: number;
  atLimit: boolean;
}

export type CampusType = "GENERIC" | "SCHOOL" | "COLLEGE" | "MONTESSORI";

export interface Campus {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  type: CampusType;
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
  // A User.email or a User.username — self-service logins (e.g.
  // students) use a username, not every login is email-shaped.
  identifier: string;
  password: string;
  captchaId: string;
  captchaAnswer: string;
}

export interface CreateCampusInput {
  name: string;
  code: string;
  // Omit for a plain (GENERIC) campus. COLLEGE seeds a default
  // Faculty/Department/Program structure — see the API's
  // college-structure-defaults.ts.
  type?: CampusType;
}

export interface UpdateCampusInput {
  name?: string;
  code?: string;
  // Does not retroactively seed the college structure/defaults — see
  // UpdateCampusDto's own comment.
  type?: CampusType;
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

export interface UpdateFacultyInput {
  campusId?: string;
  name?: string;
  code?: string;
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

export interface UpdateDepartmentInput {
  facultyId?: string;
  name?: string;
  code?: string;
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

export interface UpdateProgramInput {
  departmentId?: string;
  name?: string;
  code?: string;
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

export interface UpdateAcademicYearInput {
  name?: string;
  startDate?: string;
  endDate?: string;
}

export interface Semester {
  id: string;
  organizationId: string;
  academicYearId: string;
  name: string;
  code: string;
  sequence: number;
  startDate: string;
  endDate: string;
}

export interface CreateSemesterInput {
  academicYearId: string;
  name: string;
  code: string;
  sequence: number;
  startDate: string;
  endDate: string;
}

export interface UpdateSemesterInput {
  academicYearId?: string;
  name?: string;
  code?: string;
  sequence?: number;
  startDate?: string;
  endDate?: string;
}

// Exam-only period ("Mid Term Exam," "Internal Exam," "Pre-board
// Exam") scoped per Semester — a genuinely separate concept from
// Semester itself. Only Exam references this.
export interface TermExam {
  id: string;
  organizationId: string;
  semesterId: string;
  name: string;
  code: string;
  sequence: number;
}

export interface CreateTermExamInput {
  semesterId: string;
  name: string;
  code: string;
  sequence: number;
}

export interface UpdateTermExamInput {
  name?: string;
  code?: string;
  sequence?: number;
}

export interface Section {
  id: string;
  organizationId: string;
  programId: string;
  semesterId: string;
  name: string;
  code: string;
  capacity: number | null;
}

export interface CreateSectionInput {
  programId: string;
  semesterId: string;
  name: string;
  code: string;
  capacity?: number;
}

export interface UpdateSectionInput {
  programId?: string;
  semesterId?: string;
  name?: string;
  code?: string;
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

export interface UpdateStaffTypeInput {
  name?: string;
  code?: string;
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

export interface UpdateDesignationInput {
  name?: string;
  code?: string;
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
  middleName: string | null;
  lastName: string;
  email: string;
  phone: string | null;
  dateOfJoining: string;
  status: EmployeeStatus;
  // Set once a salary structure is assigned (Phase 7 slice 7b-2).
  salaryStructureId?: string | null;
  photoUrl: string | null;
  staffType?: StaffType;
  designation?: Designation;
  department?: Department | null;
}

// Phase 8 performance-optimization slice — the deliberately unbounded,
// deliberately narrow shape used by "pick a staff member" dropdowns
// across the app, distinct from the paginated Employee list returned
// by listEmployees().
export interface EmployeePicker {
  id: string;
  userId: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  employeeCode: string;
  status: EmployeeStatus;
}

export interface CreateEmployeeInput {
  staffTypeId: string;
  designationId: string;
  departmentId?: string;
  employeeCode: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfJoining: string;
  // Mandatory (explicit user request).
  photoUrl: string;
}

// employeeCode is deliberately absent — see UpdateEmployeeDto's own
// comment (the portal-login username is fixed at create-login time).
export interface UpdateEmployeeInput {
  staffTypeId?: string;
  designationId?: string;
  departmentId?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateOfJoining?: string;
  photoUrl?: string;
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

export interface UpdateSubjectInput {
  name?: string;
  code?: string;
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

export interface UpdateCurriculumInput {
  programId?: string;
  name?: string;
  code?: string;
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
  middleName: string | null;
  lastName: string;
  phone: string;
  email: string | null;
  occupation: string | null;
  photoUrl: string | null;
}

export interface CreateGuardianInput {
  firstName: string;
  middleName?: string;
  lastName: string;
  phone: string;
  email?: string;
  occupation?: string;
  // Mandatory (explicit user request) — same generic-storage-URL
  // two-step upload flow as Student/Employee's own photoUrl.
  photoUrl: string;
}

export interface UpdateGuardianInput {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  occupation?: string;
  photoUrl?: string;
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
  middleName: string | null;
  lastName: string;
  dateOfBirth: string;
  gender: string | null;
  status: StudentStatus;
  photoUrl: string | null;
  guardians: StudentGuardian[];
}

// Phase 8 performance-optimization slice — the deliberately unbounded,
// deliberately narrow shape used by "pick a student" dropdowns across
// the app (attendance, exams, hostel, transport, ...), distinct from
// the paginated Student list returned by listStudents().
export interface StudentPicker {
  id: string;
  userId: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  studentCode: string;
  status: StudentStatus;
}

export interface CreateStudentInput {
  // studentCode is deliberately absent — generated server-side
  // (sequential per organization), not supplied by the caller.
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  gender?: string;
  // Mandatory (explicit user request).
  photoUrl: string;
}

// studentCode is deliberately absent — immutable once assigned.
export interface UpdateStudentInput {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  photoUrl?: string;
}

export interface CreateStudentLoginInput {
  password: string;
}

// Never includes the password back — it was supplied by the admin, not
// generated. `username` is what the admin relays to the student.
export interface CreateStudentLoginResult extends SafeUser {
  username: string;
}

export type EnrollmentStatus = "ACTIVE" | "COMPLETED" | "WITHDRAWN";

export interface StudentEnrollment {
  id: string;
  studentId: string;
  programId: string;
  sectionId: string | null;
  semesterId: string;
  enrollmentDate: string;
  status: EnrollmentStatus;
  program: Program;
  section: Section | null;
  semester: Semester;
}

export interface CreateEnrollmentInput {
  programId: string;
  // Optional — some institutions don't subdivide a program+semester
  // into sections at all.
  sectionId?: string;
  semesterId: string;
  enrollmentDate: string;
}

// Org-wide enrollment list row (GET /organizations/me/enrollments) —
// same fields as StudentEnrollment plus the student it belongs to,
// since that list isn't scoped to one student's own page.
export interface EnrollmentListItem {
  id: string;
  studentId: string;
  programId: string;
  sectionId: string;
  semesterId: string;
  enrollmentDate: string;
  status: EnrollmentStatus;
  student: StudentPicker;
  program: Program;
  section: Section;
  semester: Semester;
}

export interface ListEnrollmentsParams {
  page?: number;
  pageSize?: number;
  programId?: string;
  semesterId?: string;
  sectionId?: string;
  status?: EnrollmentStatus;
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
  // studentCode is deliberately absent — generated server-side, same
  // as the direct Students-page create path.
  sectionId?: string;
  semesterId: string;
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

export interface UpdateRoomInput {
  campusId?: string;
  name?: string;
  code?: string;
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

export interface UpdatePeriodInput {
  name?: string;
  code?: string;
  sequence?: number;
  startTime?: string;
  endTime?: string;
}

export interface TeachingAssignment {
  id: string;
  organizationId: string;
  employeeId: string;
  subjectId: string;
  // Optional — some institutions don't subdivide a program+semester
  // into sections at all. programId (always present) is what keeps
  // this assignment tied to a real program either way.
  sectionId: string | null;
  programId: string;
  semesterId: string;
  employee: Employee;
  subject: Subject;
  section: Section | null;
  program: Program;
  semester: Semester;
}

export interface CreateTeachingAssignmentInput {
  employeeId: string;
  subjectId: string;
  // Optional — some institutions don't subdivide a program+semester
  // into sections at all. When omitted, programId is required
  // instead, so this assignment still resolves to exactly one
  // program either way.
  sectionId?: string;
  programId?: string;
  semesterId: string;
}

export interface UpdateTeachingAssignmentInput {
  employeeId?: string;
  subjectId?: string;
  sectionId?: string;
  programId?: string;
  semesterId?: string;
}

export interface ClassSchedule {
  id: string;
  organizationId: string;
  semesterId: string;
  teachingAssignmentId: string;
  // Nullable, following teachingAssignment.sectionId's own
  // nullability — some institutions don't use sections at all.
  sectionId: string | null;
  teacherId: string;
  roomId: string;
  periodId: string;
  dayOfWeek: number;
  room: Room;
  period: Period;
  section: Section | null;
  teacher: Employee;
  teachingAssignment: TeachingAssignment & { subject: Subject };
}

export interface CreateClassScheduleInput {
  teachingAssignmentId: string;
  roomId: string;
  periodId: string;
  dayOfWeek: number;
}

export interface UpdateClassScheduleInput {
  teachingAssignmentId?: string;
  roomId?: string;
  periodId?: string;
  dayOfWeek?: number;
}

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export interface AttendanceSession {
  id: string;
  organizationId: string;
  classScheduleId: string;
  // Nullable, following classSchedule.sectionId's own nullability —
  // some institutions don't use sections at all.
  sectionId: string | null;
  date: string;
  section: Section | null;
  classSchedule: ClassSchedule;
  studentAttendance: StudentAttendance[];
}

export interface AttendanceSessionWithRoster extends AttendanceSession {
  roster: Student[];
}

export interface StudentAttendance {
  id: string;
  organizationId: string;
  attendanceSessionId: string;
  studentId: string;
  status: AttendanceStatus;
  remarks: string | null;
  student: Student;
}

export interface CreateAttendanceSessionInput {
  classScheduleId: string;
  date: string;
}

export interface MarkAttendanceEntryInput {
  studentId: string;
  status: AttendanceStatus;
  remarks?: string;
}

export interface MarkAttendanceInput {
  entries: MarkAttendanceEntryInput[];
}

export interface CorrectAttendanceInput {
  status: AttendanceStatus;
  reason: string;
}

export type StaffAttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "ON_LEAVE" | "HALF_DAY";

export interface StaffAttendance {
  id: string;
  organizationId: string;
  employeeId: string;
  date: string;
  status: StaffAttendanceStatus;
  remarks: string | null;
  employee: Employee;
}

export interface CreateStaffAttendanceInput {
  employeeId: string;
  date: string;
  status: StaffAttendanceStatus;
  remarks?: string;
}

export interface Syllabus {
  id: string;
  organizationId: string;
  curriculumSubjectId: string;
  semesterId: string;
  name: string | null;
  description: string | null;
  curriculumSubject: CurriculumSubject & { subject: Subject; curriculum: Curriculum };
  semester: Semester;
}

export interface CreateSyllabusInput {
  curriculumSubjectId: string;
  semesterId: string;
  name?: string;
  description?: string;
}

export type SyllabusNodeLevel = "UNIT" | "CHAPTER" | "TOPIC" | "SUBTOPIC";

export interface SyllabusNode {
  id: string;
  organizationId: string;
  syllabusId: string;
  parentId: string | null;
  level: SyllabusNodeLevel;
  sequence: number;
  name: string;
  description: string | null;
  learningObjectives: LearningObjective[];
}

export interface SyllabusWithNodes extends Syllabus {
  nodes: SyllabusNode[];
}

export interface CreateSyllabusNodeInput {
  parentId?: string;
  level: SyllabusNodeLevel;
  sequence: number;
  name: string;
  description?: string;
}

export interface LearningObjective {
  id: string;
  organizationId: string;
  syllabusNodeId: string;
  sequence: number;
  description: string;
}

export interface CreateLearningObjectiveInput {
  sequence: number;
  description: string;
}

export interface LessonPlan {
  id: string;
  organizationId: string;
  teachingAssignmentId: string;
  syllabusNodeId: string;
  title: string;
  objectives: string;
  materials: string | null;
  plannedDate: string | null;
  notes: string | null;
  teachingAssignment: TeachingAssignment;
  syllabusNode: SyllabusNode;
}

export interface CreateLessonPlanInput {
  teachingAssignmentId: string;
  syllabusNodeId: string;
  title: string;
  objectives: string;
  materials?: string;
  plannedDate?: string;
  notes?: string;
}

export type ClassSessionStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED";

export interface ClassMaterial {
  id: string;
  organizationId: string;
  classSessionId: string;
  title: string;
  url: string | null;
  description: string | null;
}

export interface CreateClassMaterialInput {
  title: string;
  url?: string;
  description?: string;
}

export interface ClassSession {
  id: string;
  organizationId: string;
  classScheduleId: string;
  // Nullable, following classSchedule.sectionId's own nullability —
  // some institutions don't use sections at all.
  sectionId: string | null;
  date: string;
  lessonPlanId: string | null;
  actualSyllabusNodeId: string | null;
  progressNotes: string | null;
  status: ClassSessionStatus;
  completedAt: string | null;
  classSchedule: ClassSchedule;
  section: Section | null;
  lessonPlan: LessonPlan | null;
  actualSyllabusNode: SyllabusNode | null;
  materials: ClassMaterial[];
}

export interface CreateClassSessionInput {
  classScheduleId: string;
  date: string;
  lessonPlanId?: string;
}

export interface RecordProgressInput {
  actualSyllabusNodeId?: string;
  progressNotes?: string;
}

export interface MyClassesTodayEntry {
  classSchedule: ClassSchedule;
  classSession: ClassSession | null;
  attendanceMarked: number | null;
}

export interface SyllabusNodeProgress {
  nodeId: string;
  name: string;
  level: SyllabusNodeLevel;
  status: "COMPLETED" | "NOT_STARTED";
  completedAt: string | null;
}

export type SubmissionType = "WRITTEN" | "OBJECTIVE" | "PROJECT" | "PRACTICAL" | "FILE" | "IMAGE" | "PDF" | "LINK" | "TEXT";
export type SubmissionStatus = "SUBMITTED" | "GRADED";

export interface AssignmentSubmission {
  id: string;
  organizationId: string;
  assignmentId: string;
  studentId: string;
  content: string | null;
  submittedAt: string;
  status: SubmissionStatus;
  score: number | null;
  feedback: string | null;
  student: Student;
}

export interface Assignment {
  id: string;
  organizationId: string;
  teachingAssignmentId: string;
  title: string;
  description: string | null;
  submissionType: SubmissionType;
  dueDate: string | null;
  allowResubmission: boolean;
  maxScore: number | null;
  // Added for self-service assignments (LMS discovery slice 3).
  isPublished: boolean;
  teachingAssignment: TeachingAssignment;
  submissions: AssignmentSubmission[];
}

export interface CreateAssignmentInput {
  teachingAssignmentId: string;
  title: string;
  description?: string;
  submissionType: SubmissionType;
  dueDate?: string;
  allowResubmission?: boolean;
  maxScore?: number;
}

export interface UpdateAssignmentInput {
  title?: string;
  description?: string;
  dueDate?: string;
  allowResubmission?: boolean;
  maxScore?: number;
  isPublished?: boolean;
}

export interface CreateSubmissionInput {
  studentId: string;
  content?: string;
}

export interface GradeSubmissionInput {
  score: number;
  feedback?: string;
}

// Teacher-portal's own assignment list doesn't include the parent
// TeachingAssignment (the caller already knows which course they
// picked) — narrower than Assignment, not lying about the shape.
export type TeacherPortalAssignmentListItem = Omit<Assignment, "teachingAssignment">;

// Student-portal assignments (LMS discovery slice 3): never includes
// other students' submissions, and the one submission it does include
// (the caller's own) never includes the `student` relation — the
// caller already knows who they are.
export interface AssignmentTeachingAssignmentSummary {
  id: string;
  subjectId: string;
  sectionId: string;
  semesterId: string;
  employeeId: string;
  subject: Subject;
  employee: Employee;
}

export type StudentOwnSubmission = Omit<AssignmentSubmission, "student">;

export interface StudentPortalAssignment {
  id: string;
  organizationId: string;
  teachingAssignmentId: string;
  title: string;
  description: string | null;
  submissionType: SubmissionType;
  dueDate: string | null;
  allowResubmission: boolean;
  maxScore: number | null;
  isPublished: boolean;
  teachingAssignment: AssignmentTeachingAssignmentSummary;
  mySubmission: StudentOwnSubmission | null;
}

export interface SubmitAssignmentInput {
  content?: string;
}

// Course-level announcements (LMS discovery slice 5).

export interface Announcement {
  id: string;
  organizationId: string;
  teachingAssignmentId: string;
  title: string;
  body: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAnnouncementInput {
  teachingAssignmentId: string;
  title: string;
  body: string;
}

export interface UpdateAnnouncementInput {
  title?: string;
  body?: string;
  isPublished?: boolean;
}

// Student-portal announcements never include the parent
// TeachingAssignment's full graph — just enough to show the course
// name and instructor, same narrowing precedent as
// AssignmentTeachingAssignmentSummary.
export interface StudentPortalAnnouncement extends Announcement {
  teachingAssignment: AssignmentTeachingAssignmentSummary;
}

// Course-level discussions (LMS discovery slice 6).

export interface DiscussionTopic {
  id: string;
  organizationId: string;
  teachingAssignmentId: string;
  title: string;
  body: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDiscussionTopicInput {
  teachingAssignmentId: string;
  title: string;
  body: string;
}

export interface UpdateDiscussionTopicInput {
  title?: string;
  body?: string;
  isPublished?: boolean;
}

// Exactly one of authorStudent/authorEmployee is set — mirrors
// DiscussionPost's own studentId/employeeId XOR (enforced server-side,
// not by this type). Either can be null if the linked person was later
// removed — the post itself still stands.
export interface DiscussionPost {
  id: string;
  organizationId: string;
  discussionTopicId: string;
  authorStudentId: string | null;
  authorEmployeeId: string | null;
  body: string;
  createdAt: string;
  authorStudent: Student | null;
  authorEmployee: Employee | null;
}

export interface DiscussionTopicWithPosts extends DiscussionTopic {
  posts: DiscussionPost[];
}

export interface CreateDiscussionPostInput {
  body: string;
}

// Student-portal's flat, cross-course feed — same narrowing precedent
// as StudentPortalAnnouncement.
export interface StudentPortalDiscussionTopic extends DiscussionTopic {
  teachingAssignment: AssignmentTeachingAssignmentSummary;
}

export type KnowledgeCheckStatus = "DRAFT" | "PUBLISHED";

export interface KnowledgeCheckQuestion {
  id: string;
  organizationId: string;
  knowledgeCheckId: string;
  sequence: number;
  text: string;
  options: string[];
  correctOptionIndex: number;
}

export interface KnowledgeCheckAttempt {
  id: string;
  organizationId: string;
  knowledgeCheckId: string;
  studentId: string;
  // Added for self-service quiz-taking (LMS discovery slice 4) — null
  // while a self-service attempt is still in progress; always set for an
  // admin-recorded attempt (CreateAttemptInput) and for any attempt once
  // submitted.
  startedAt: string | null;
  answers: number[] | null;
  score: number | null;
  submittedAt: string | null;
  student: Student;
}

export interface KnowledgeCheck {
  id: string;
  organizationId: string;
  teachingAssignmentId: string;
  syllabusNodeId: string | null;
  title: string;
  durationMinutes: number | null;
  status: KnowledgeCheckStatus;
  teachingAssignment: TeachingAssignment;
  syllabusNode: SyllabusNode | null;
  questions: KnowledgeCheckQuestion[];
  attempts: KnowledgeCheckAttempt[];
}

export interface CreateKnowledgeCheckInput {
  teachingAssignmentId: string;
  syllabusNodeId?: string;
  title: string;
  durationMinutes?: number;
}

export interface CreateQuestionInput {
  sequence: number;
  text: string;
  options: string[];
  correctOptionIndex: number;
}

export interface CreateAttemptInput {
  studentId: string;
  answers: number[];
}

// Teacher-portal's own quiz list doesn't include the parent
// TeachingAssignment/syllabusNode (the caller already knows which
// course they picked) — narrower than KnowledgeCheck, not lying about
// the shape (LMS discovery slice 4, mirrors TeacherPortalAssignmentListItem).
export type TeacherPortalQuizListItem = Omit<KnowledgeCheck, "teachingAssignment" | "syllabusNode">;

// Self-service quiz-taking (LMS discovery slice 4) — adapts exam-taking's
// shuffle/autosave/auto-score engine onto KnowledgeCheck.

export interface QuizAttemptSummary {
  startedAt: string | null;
  submittedAt: string | null;
  score: number | null;
}

// Metadata + the caller's own attempt status only — never the question
// content (that's only ever revealed by starting the quiz, see
// QuizAttemptState below) or another student's attempt.
export interface StudentPortalQuiz {
  id: string;
  title: string;
  durationMinutes: number | null;
  questionCount: number;
  teachingAssignment: AssignmentTeachingAssignmentSummary;
  myAttempt: QuizAttemptSummary | null;
}

// One question in shuffled display order/options — never the correct
// answer. selectedOptionIndex (if present) is the caller's own
// previously-saved answer, translated into this shuffled order.
export interface QuizTakingQuestion {
  id: string;
  text: string;
  options: string[];
  selectedOptionIndex?: number;
}

export interface QuizAttemptState {
  deadline: string | null;
  questions: QuizTakingQuestion[];
}

export interface SaveQuizAnswerInput {
  selectedOptionIndex: number;
}

export interface SyllabusNodeProgressGroup {
  subjectName: string;
  nodes: SyllabusNodeProgress[];
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
}

export interface StaffAttendanceSummary {
  present: number;
  absent: number;
  late: number;
  onLeave: number;
  total: number;
}

// The dashboard endpoints each query for a specific summary shape, not
// the full entity graph — these types are deliberately narrower than
// TeachingAssignment/ClassSchedule/ClassSession elsewhere in this file
// (e.g. no top-level `teacher` on DashboardClassSchedule, no
// classSchedule/lessonPlan/materials on DashboardClassSession), so they
// match what each query's `include` actually returns rather than
// reusing a broader type and lying about the shape.

export interface DashboardTeachingAssignment {
  id: string;
  subjectId: string;
  sectionId: string;
  semesterId: string;
  subject: Subject;
  section: Section;
  semester: Semester;
}

export interface DashboardClassSchedule {
  id: string;
  dayOfWeek: number;
  period: Period;
  room: Room;
  section: Section;
  teachingAssignment: { subject: Subject };
}

export interface StudentTimetableEntry {
  id: string;
  dayOfWeek: number;
  period: Period;
  room: Room;
  teachingAssignment: { subject: Subject; employee: Employee };
}

export interface DashboardClassSession {
  id: string;
  date: string;
  status: ClassSessionStatus;
  progressNotes: string | null;
  section: Section;
  actualSyllabusNode: SyllabusNode | null;
}

export interface AssignmentSummary {
  id: string;
  teachingAssignmentId: string;
  title: string;
  submissionType: SubmissionType;
  dueDate: string | null;
  allowResubmission: boolean;
  maxScore: number | null;
}

export interface DashboardAssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  content: string | null;
  submittedAt: string;
  status: SubmissionStatus;
  score: number | null;
  feedback: string | null;
  assignment: AssignmentSummary;
}

export interface KnowledgeCheckSummary {
  id: string;
  teachingAssignmentId: string;
  syllabusNodeId: string | null;
  title: string;
  durationMinutes: number | null;
  status: KnowledgeCheckStatus;
}

export interface DashboardKnowledgeCheckAttempt {
  id: string;
  knowledgeCheckId: string;
  studentId: string;
  answers: number[];
  score: number;
  submittedAt: string;
  knowledgeCheck: KnowledgeCheckSummary;
}

export interface StudentDashboard {
  student: Student;
  activeEnrollment: StudentEnrollment | null;
  weeklyTimetable: StudentTimetableEntry[];
  attendanceSummary: AttendanceSummary;
  assignmentSubmissions: DashboardAssignmentSubmission[];
  knowledgeCheckAttempts: DashboardKnowledgeCheckAttempt[];
  syllabusProgress: SyllabusNodeProgressGroup[];
}

export interface TeacherDashboard {
  employee: Employee;
  teachingAssignments: DashboardTeachingAssignment[];
  classSchedules: DashboardClassSchedule[];
  pendingGrading: (AssignmentSubmission & { assignmentTitle: string })[];
  recentClassSessions: DashboardClassSession[];
  staffAttendanceSummary: StaffAttendanceSummary;
}

export interface ParentDashboard {
  guardian: Guardian;
  children: (StudentDashboard & { relationship: string; isPrimaryContact: boolean })[];
}

export interface ExamType {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExamTypeInput {
  name: string;
  code: string;
}

export interface UpdateExamTypeInput {
  name?: string;
  code?: string;
}

export interface GradeBand {
  minPercentage: number;
  maxPercentage: number;
  grade: string;
  gpa?: number;
  remarks?: string;
}

export interface GradingScheme {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  description: string | null;
  bands: GradeBand[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateGradingSchemeInput {
  name: string;
  code: string;
  description?: string;
  bands: GradeBand[];
}

export interface UpdateGradingSchemeInput {
  name?: string;
  code?: string;
  description?: string;
  bands?: GradeBand[];
}

export type QuestionType = "OBJECTIVE" | "SUBJECTIVE";

export interface ExamQuestion {
  id: string;
  organizationId: string;
  questionBankId: string;
  sequence: number;
  text: string;
  questionType: QuestionType;
  marks: number;
  options: string[] | null;
  correctOptionIndex: number | null;
  modelAnswer: string | null;
}

export interface QuestionBankSummary {
  id: string;
  organizationId: string;
  curriculumSubjectId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  curriculumSubject: CurriculumSubject & { subject: Subject; curriculum: Curriculum };
}

export interface QuestionBank extends QuestionBankSummary {
  questions: ExamQuestion[];
}

export interface CreateQuestionBankInput {
  curriculumSubjectId: string;
  name: string;
  description?: string;
}

export interface CreateExamQuestionInput {
  sequence: number;
  text: string;
  questionType: QuestionType;
  marks: number;
  options?: string[];
  correctOptionIndex?: number;
  modelAnswer?: string;
}

export interface ExamSummary {
  id: string;
  organizationId: string;
  examTypeId: string;
  termExamId: string;
  name: string;
  gradingSchemeId: string | null;
  createdAt: string;
  updatedAt: string;
  examType: ExamType;
  termExam: TermExam & { semester: Semester };
  gradingScheme: GradingScheme | null;
}

export interface ExamRoomAssignment {
  id: string;
  organizationId: string;
  examScheduleId: string;
  roomId: string;
  capacity: number | null;
  createdAt: string;
  room: Room;
}

export interface ExamScheduleDetail {
  id: string;
  organizationId: string;
  examSubjectId: string;
  date: string;
  startTime: string;
  endTime: string;
  createdAt: string;
  updatedAt: string;
  examRooms: ExamRoomAssignment[];
}

export interface ExamSubjectDetail {
  id: string;
  organizationId: string;
  examId: string;
  curriculumSubjectId: string;
  fullMarks: number;
  passMarks: number;
  questionBankId: string | null;
  createdAt: string;
  curriculumSubject: CurriculumSubject;
  examSchedule: ExamScheduleDetail | null;
}

export interface Exam extends ExamSummary {
  examSubjects: ExamSubjectDetail[];
}

export interface CreateExamInput {
  examTypeId: string;
  termExamId: string;
  name: string;
  gradingSchemeId?: string;
}

// Plain create() responses — no relations loaded, unlike the nested
// *Detail types above used for getExam's fuller fetch.
export interface ExamSubjectRecord {
  id: string;
  organizationId: string;
  examId: string;
  curriculumSubjectId: string;
  fullMarks: number;
  passMarks: number;
  questionBankId: string | null;
  createdAt: string;
}

export interface CreateExamSubjectInput {
  curriculumSubjectId: string;
  fullMarks: number;
  passMarks: number;
  // Only set when this subject is delivered online.
  questionBankId?: string;
}

export interface ExamScheduleRecord {
  id: string;
  organizationId: string;
  examSubjectId: string;
  date: string;
  startTime: string;
  endTime: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExamScheduleInput {
  date: string;
  startTime: string;
  endTime: string;
}

export interface ExamRoomRecord {
  id: string;
  organizationId: string;
  examScheduleId: string;
  roomId: string;
  capacity: number | null;
  createdAt: string;
}

export interface CreateExamRoomInput {
  roomId: string;
  capacity?: number;
}

// Plain fields only — listAttempts' student include has no nested
// relations, unlike the full Student type (which carries guardians).
export interface StudentSummary {
  id: string;
  organizationId: string;
  studentCode: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string | null;
  status: StudentStatus;
}

export interface MarksRecord {
  id: string;
  organizationId: string;
  examAttemptId: string;
  obtainedMarks: number;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
}

// recordAttempt's create/update response — plain fields only.
export interface ExamAttemptRecord {
  id: string;
  organizationId: string;
  examSubjectId: string;
  studentId: string;
  status: AttendanceStatus;
  // Online exam-taking lifecycle — both null for admin-recorded
  // (paper-exam) attempts and until a student actually opens/submits
  // an online one.
  startedAt: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GradeRecord {
  id: string;
  organizationId: string;
  examAttemptId: string;
  percentage: number;
  grade: string;
  gpa: number | null;
  createdAt: string;
  updatedAt: string;
}

// listAttempts' fuller shape — includes the student, any marks, and any
// computed grade.
export interface ExamAttempt extends ExamAttemptRecord {
  student: StudentSummary;
  marks: MarksRecord | null;
  grade: GradeRecord | null;
}

export interface RecordExamAttemptInput {
  studentId: string;
  status: AttendanceStatus;
}

export interface RecordMarksInput {
  obtainedMarks: number;
  remarks?: string;
}

export interface ReportCardRecord {
  id: string;
  organizationId: string;
  examId: string;
  studentId: string;
  totalObtainedMarks: number;
  totalFullMarks: number;
  percentage: number;
  overallGrade: string;
  overallGpa: number | null;
  generatedAt: string;
  updatedAt: string;
}

export interface ReportCardSubject {
  id: string;
  examSubjectId: string;
  studentId: string;
  status: AttendanceStatus;
  examSubject: { id: string; fullMarks: number; passMarks: number; curriculumSubject: CurriculumSubject };
  marks: MarksRecord;
  grade: GradeRecord;
}

// getReportCard's fuller shape — the aggregate row plus its per-subject
// breakdown, derived (not stored) from Grade rows joined through
// ExamAttempt/ExamSubject, per the schema's reasoning.
export interface ReportCard extends ReportCardRecord {
  subjects: ReportCardSubject[];
}

// ── Online exam-taking (self-service, portal-only) ─────────────────────

export interface ExamTakingSubject {
  id: string;
  examId: string;
  curriculumSubjectId: string;
  fullMarks: number;
  passMarks: number;
  questionBankId: string | null;
  curriculumSubject: { subject: Subject };
  examSchedule: ExamScheduleRecord | null;
}

// listMyExams' shape — an ExamAttempt with its exam subject nested.
export interface MyExamAttempt {
  id: string;
  examSubjectId: string;
  studentId: string;
  status: AttendanceStatus;
  startedAt: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  examSubject: ExamTakingSubject;
}

// startExam's per-question shape — options are already shuffled and
// never carry the answer key (no correctOptionIndex/modelAnswer, unlike
// the admin-facing ExamQuestion type).
export interface ExamTakingQuestion {
  id: string;
  text: string;
  questionType: QuestionType;
  marks: number;
  options?: string[];
  selectedOptionIndex?: number;
  textAnswer?: string;
}

export interface ExamTakingState {
  deadline: string;
  questions: ExamTakingQuestion[];
}

export interface SaveAnswerInput {
  selectedOptionIndex?: number;
  textAnswer?: string;
}

export interface AnswerRecord {
  id: string;
  organizationId: string;
  examAttemptId: string;
  questionId: string;
  selectedOptionIndex: number | null;
  textAnswer: string | null;
  score: number | null;
  createdAt: string;
  updatedAt: string;
}

// listAnswers' admin-facing shape — includes the real question (with
// the answer key), unlike ExamTakingQuestion which the student sees.
export interface AnswerWithQuestion extends AnswerRecord {
  question: ExamQuestion;
}

// ── CCTV / Biometric — privacy & consent foundation (Phase 6 slice 6a),
// camera capture/matching (slice 6c) ─────────────────────────────────

export interface BiometricPolicyRecord {
  organizationId: string;
  enabled: boolean;
  retentionDays: number;
  matchConfidenceThreshold: number;
}

export interface UpdateBiometricPolicyInput {
  enabled?: boolean;
  retentionDays?: number;
  matchConfidenceThreshold?: number;
}

export type FaceEnrollmentStatus = "ACTIVE" | "WITHDRAWN";

export interface CreateFaceEnrollmentInput {
  studentId?: string;
  staffId?: string;
  consentGivenBy: string;
  consentGivenAt?: string;
}

export interface FaceEnrollmentRecord {
  id: string;
  organizationId: string;
  studentId: string | null;
  staffId: string | null;
  status: FaceEnrollmentStatus;
  consentGivenAt: string;
  consentGivenBy: string;
  consentWithdrawnAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Deliberately no `embedding` field — Prisma's Unsupported() column
// can't be selected/returned through the normal client API at all, so
// this is the complete shape the server can ever send, not a
// client-side redaction.
export interface FaceEmbeddingSummary {
  id: string;
  modelVersion: string;
  createdAt: string;
}

// listEnrollments' fuller shape — the linked student/staff record, so
// the admin UI can show a name without a second lookup, plus whether an
// enrollment photo has been captured yet.
export interface FaceEnrollment extends FaceEnrollmentRecord {
  student: StudentSummary | null;
  staff: Employee | null;
  faceEmbedding: FaceEmbeddingSummary | null;
}

export interface AddEnrollmentPhotoResult {
  enrollmentId: string;
  detScore: number;
  modelName: string;
}

export type CameraAdapterType = "SIMULATED" | "RTSP" | "USB_WEBCAM";
export type CameraStatus = "ACTIVE" | "INACTIVE";

export interface CreateCameraInput {
  name: string;
  location?: string;
  adapterType?: CameraAdapterType;
}

export interface CameraRecord {
  id: string;
  organizationId: string;
  name: string;
  location: string | null;
  adapterType: CameraAdapterType;
  status: CameraStatus;
  // Set on every successful capture (ingestEvent), regardless of
  // whether a face was detected — the natural heartbeat for "is this
  // camera actually online," independent of the CameraStatus admin
  // toggle. Null until the camera's first capture ever arrives.
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type FaceMatchResultValue = "IDENTIFIED" | "POSSIBLE_MATCH" | "UNKNOWN";
export type FaceMatchReviewDecision = "CONFIRMED" | "REJECTED";

export interface FaceMatchEventRecord {
  id: string;
  organizationId: string;
  cameraEventId: string;
  matchedEnrollmentId: string | null;
  confidence: number;
  result: FaceMatchResultValue;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewDecision: FaceMatchReviewDecision | null;
  // Set only when this exact match event is what caused a
  // StudentAttendance/StaffAttendance row to be created (Phase 6 slice
  // 6d) — never when one already existed ("augments, never replaces").
  reconciledStudentAttendanceId: string | null;
  reconciledStaffAttendanceId: string | null;
  createdAt: string;
}

// ingestEvent's response shape — the created CameraEvent (never the raw
// image bytes) plus every face-match attempt it produced.
export interface CameraEventResult {
  id: string;
  organizationId: string;
  cameraId: string;
  capturedAt: string;
  createdAt: string;
  hasImage: boolean;
  matches: (FaceMatchEventRecord & { matchedEnrollment: FaceEnrollment | null })[];
}

// listFaceMatchEvents' fuller shape — the review queue.
export interface FaceMatchEvent extends FaceMatchEventRecord {
  matchedEnrollment: FaceEnrollment | null;
  cameraEvent: { id: string; capturedAt: string; camera: CameraRecord };
}

export interface ReviewFaceMatchInput {
  decision: FaceMatchReviewDecision;
}

// ── Finance (Phase 7 slice 7a-1) ────────────────────────────────────────
// Every money field is a Prisma Decimal server-side, which serializes to
// JSON as a string (Decimal's own toJSON()) — typed as `string` here to
// match the actual wire format, not `number`. Format/parse at the UI
// layer, don't assume it's already numeric.

export interface FeeCategoryRecord {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFeeCategoryInput {
  name: string;
  code: string;
  description?: string;
}

export interface UpdateFeeCategoryInput {
  name?: string;
  code?: string;
  description?: string;
}

export interface FeeStructureItemRecord {
  id: string;
  organizationId: string;
  feeStructureId: string;
  feeCategoryId: string;
  amount: string;
  feeCategory: FeeCategoryRecord;
}

export interface FeeStructureRecord {
  id: string;
  organizationId: string;
  programId: string;
  semesterId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  program: Program;
  semester: Semester;
  items: FeeStructureItemRecord[];
}

export interface CreateFeeStructureInput {
  programId: string;
  semesterId: string;
  name: string;
  items: { feeCategoryId: string; amount: number }[];
}

export interface AssignFeeStructureInput {
  studentEnrollmentId: string;
  dueDate: string;
}

export interface AssignFeeStructureBulkInput {
  dueDate: string;
}

export interface AssignFeeStructureBulkResult {
  assigned: string[];
  skipped: { studentEnrollmentId: string; reason: string }[];
}

export interface AssignFeeStructureBulkPreview {
  eligibleCount: number;
  alreadyAssignedCount: number;
  perStudentAmount: number;
  totalAmount: number;
}

export type InvoiceStatus = "PENDING" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";
export type PaymentMethod = "CASH" | "BANK_TRANSFER" | "CHEQUE" | "ESEWA";

export interface InvoiceItemRecord {
  id: string;
  organizationId: string;
  invoiceId: string;
  feeCategoryId: string;
  description: string | null;
  amount: string;
  feeCategory: FeeCategoryRecord;
}

export interface PaymentRecord {
  id: string;
  organizationId: string;
  invoiceId: string;
  amount: string;
  method: PaymentMethod;
  reference: string | null;
  recordedBy: string | null;
  paidAt: string;
  createdAt: string;
}

export interface DiscountRecord {
  id: string;
  organizationId: string;
  invoiceId: string;
  scholarshipId: string | null;
  amount: string;
  reason: string;
  appliedBy: string | null;
  createdAt: string;
}

export interface InvoiceRecord {
  id: string;
  organizationId: string;
  studentId: string;
  studentEnrollmentId: string;
  totalAmount: string;
  dueDate: string;
  status: InvoiceStatus;
  createdAt: string;
  updatedAt: string;
  student: StudentSummary;
  items: InvoiceItemRecord[];
  payments: PaymentRecord[];
  discounts: DiscountRecord[];
}

// Phase 8 performance-optimization slice — the list endpoint no longer
// returns the full InvoiceRecord graph (items/payments/discounts, full
// Student row); the list UI never rendered those, only student's name.
// getInvoice()/InvoiceRecord are unaffected — the detail fetch still
// returns everything.
export interface InvoiceListItem {
  id: string;
  organizationId: string;
  studentId: string;
  studentEnrollmentId: string;
  totalAmount: string;
  dueDate: string;
  status: InvoiceStatus;
  createdAt: string;
  updatedAt: string;
  student: { firstName: string; lastName: string };
}

export interface RecordPaymentInput {
  amount: number;
  method: PaymentMethod;
  reference?: string;
  paidAt?: string;
}

export interface ApplyDiscountInput {
  amount: number;
  reason: string;
}

export interface IssueRefundInput {
  amount: number;
  reason: string;
}

export interface RefundRecord {
  id: string;
  organizationId: string;
  paymentId: string;
  amount: string;
  reason: string;
  processedBy: string | null;
  createdAt: string;
}

// eSewa online payment (Phase 7 slice 7a-2).
export interface InitiateEsewaPaymentInput {
  amount: number;
}

// Fields for a real browser form-POST to eSewa's own gateway — never
// call this with fetch/XHR, it's a genuine redirect. See
// submitEsewaForm in apps/web/src/lib/esewa.ts.
export interface EsewaFormPayload {
  actionUrl: string;
  fields: Record<string, string>;
}

export interface ConfirmEsewaPaymentResult {
  status: "COMPLETE";
  invoiceId: string;
  payment: PaymentRecord | null;
}

// The platform's own revenue — a school paying Ovexa itself to unlock
// a higher edition (services/api/src/modules/billing) — a genuinely
// separate payment flow from the eSewa fee-collection types above,
// not an extension of them.
export interface InitiateUpgradeInput {
  targetEdition: "PROFESSIONAL" | "ULTRA";
}

export interface ConfirmUpgradeResult {
  status: "COMPLETE";
  edition: Edition;
  editionExpiresAt: string | null;
}

// Manual fallback while eSewa checkout is disabled on the billing
// page (see BillingService.submitUpgradeRequest's own doc comment) —
// no payment involved, just a recorded request Ovexa staff follow up
// on and resolve from the Platform Admin console.
export interface SubmitUpgradeRequestInput {
  targetEdition: "PROFESSIONAL" | "ULTRA";
  contactPhone: string;
  notes?: string;
}

export interface SubmitUpgradeRequestResult {
  id: string;
  status: "PENDING";
}

export interface PlatformUpgradeRequestSummary {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  targetEdition: Edition;
  contactPhone: string;
  notes: string | null;
  requesterEmail: string;
  createdAt: string;
}

// The portal's own invoice list omits `student` (the caller already
// knows who they are) — everything else matches InvoiceRecord.
export type PortalInvoiceRecord = Omit<InvoiceRecord, "student">;

export interface ScholarshipRecord {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  percentage: number | null;
  amount: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScholarshipInput {
  name: string;
  description?: string;
  percentage?: number;
  amount?: number;
}

export interface UpdateScholarshipInput {
  name?: string;
  description?: string;
  percentage?: number;
  amount?: number;
}

export interface AssignScholarshipInput {
  scholarshipId: string;
}

export type FinancialTransactionType =
  | "INVOICE_CREATED"
  | "PAYMENT_RECORDED"
  | "DISCOUNT_APPLIED"
  | "SCHOLARSHIP_APPLIED"
  | "REFUND_ISSUED";

export interface FinancialTransactionRecord {
  id: string;
  organizationId: string;
  type: FinancialTransactionType;
  amount: string;
  invoiceId: string | null;
  paymentId: string | null;
  discountId: string | null;
  refundId: string | null;
  createdAt: string;
}

export interface StudentScholarshipRecord {
  id: string;
  organizationId: string;
  studentId: string;
  scholarshipId: string;
  assignedAt: string;
  active: boolean;
  scholarship: ScholarshipRecord;
}

// Roles & Permissions admin.
export interface PermissionRecord {
  id: string;
  resource: string;
  action: string;
  description: string | null;
}

export interface RolePermissionRecord {
  id: string;
  roleId: string;
  permissionId: string;
  permission: PermissionRecord;
}

export interface RoleRecord {
  id: string;
  organizationId: string | null;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  rolePermissions: RolePermissionRecord[];
}

export interface CreateRoleInput {
  name: string;
  description?: string;
  permissionIds: string[];
}

export interface UpdateRoleInput {
  name?: string;
  description?: string;
  permissionIds?: string[];
}

export interface UserRoleAssignment {
  id: string;
  userId: string;
  roleId: string;
  campusId: string | null;
  createdAt: string;
  role: RoleRecord;
}

export interface UserSummary {
  id: string;
  email: string;
  username: string | null;
  firstName: string;
  lastName: string;
  status: UserStatus;
  createdAt: string;
  userRoles: UserRoleAssignment[];
}

export interface AssignRoleInput {
  roleId: string;
  campusId?: string;
}

export interface InviteUserInput {
  email: string;
  firstName: string;
  lastName: string;
  roleId: string;
}

// The bare created row (no userRoles include, unlike UserSummary —
// refetch listOrgUsers() to see the new user in that shape).
// tempPassword is shown exactly once, in this one response — never
// re-fetchable afterward.
export interface InviteUserResult {
  user: {
    id: string;
    email: string;
    username: string | null;
    firstName: string;
    lastName: string;
    status: UserStatus;
    createdAt: string;
  };
  tempPassword: string;
}

export interface AuditLogRecord {
  id: string;
  organizationId: string;
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  metadata: unknown;
  createdAt: string;
  user: { firstName: string; lastName: string; email: string } | null;
}

// HR & Payroll, part 1: Leave Management (Phase 7 slice 7b-1).
export type LeaveRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface LeaveTypeRecord {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  defaultDaysPerYear: number;
  isPaid: boolean;
  carryForward: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateLeaveTypeInput {
  name?: string;
  code?: string;
  defaultDaysPerYear?: number;
  isPaid?: boolean;
  carryForward?: boolean;
}

export interface CreateLeaveTypeInput {
  name: string;
  code: string;
  defaultDaysPerYear: number;
  isPaid?: boolean;
  carryForward?: boolean;
}

export interface AllocateLeaveBalanceInput {
  employeeId: string;
  leaveTypeId: string;
  year: number;
  allocatedDays: number;
}

export interface StaffLeaveBalanceRecord {
  id: string;
  organizationId: string;
  employeeId: string;
  leaveTypeId: string;
  year: number;
  allocatedDays: number;
  usedDays: number;
  remainingDays: number;
  leaveType: LeaveTypeRecord;
}

export interface CreateLeaveRequestInput {
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

export interface ReviewLeaveRequestInput {
  reviewComment?: string;
}

export interface LeaveRequestRecord {
  id: string;
  organizationId: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: LeaveRequestStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewComment: string | null;
  createdAt: string;
  updatedAt: string;
  employee: Employee;
  leaveType: LeaveTypeRecord;
  reviewer?: { firstName: string; lastName: string } | null;
}

// HR & Payroll, part 2: Payroll (Phase 7 slice 7b-2).
export type PayrollItemType = "EARNING" | "DEDUCTION";
export type PayrollStatus = "DRAFT" | "FINALIZED" | "PAID" | "CANCELLED";

export interface SalaryStructureItemInput {
  type: PayrollItemType;
  name: string;
  amount?: number;
  percentOfBasic?: number;
}

export interface SalaryStructureItemRecord {
  id: string;
  salaryStructureId: string;
  type: PayrollItemType;
  name: string;
  amount: string | null;
  percentOfBasic: string | null;
}

export interface CreateSalaryStructureInput {
  name: string;
  basicSalary: number;
  items: SalaryStructureItemInput[];
}

export interface SalaryStructureRecord {
  id: string;
  organizationId: string;
  name: string;
  basicSalary: string;
  createdAt: string;
  updatedAt: string;
  items: SalaryStructureItemRecord[];
}

export interface GeneratePayrollInput {
  periodMonth: number;
  periodYear: number;
}

export interface GeneratePayrollResult {
  generated: string[];
  skipped: { employeeId: string; reason: string }[];
}

export interface PayrollGenerationPreview {
  eligibleCount: number;
  alreadyGeneratedCount: number;
  grossTotal: number;
}

export interface AddPayrollItemInput {
  type: PayrollItemType;
  name: string;
  amount: number;
}

export interface PayrollItemRecord {
  id: string;
  payrollId: string;
  type: PayrollItemType;
  name: string;
  amount: string;
}

export interface MarkPayrollPaidInput {
  paymentMethod: PaymentMethod;
}

export interface PayrollRecord {
  id: string;
  organizationId: string;
  employeeId: string;
  periodMonth: number;
  periodYear: number;
  status: PayrollStatus;
  grossPay: string | null;
  totalDeductions: string | null;
  netPay: string | null;
  paymentMethod: PaymentMethod | null;
  paidAt: string | null;
  finalizedAt: string | null;
  finalizedBy: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  employee: Employee;
  items: PayrollItemRecord[];
  finalizer?: { firstName: string; lastName: string } | null;
}

// Transport, part 1: core roster (Phase 7 slice 7d-1).
export type VehicleStatus = "ACTIVE" | "MAINTENANCE" | "INACTIVE";

export interface VehicleRecord {
  id: string;
  organizationId: string;
  registrationNumber: string;
  type: string;
  capacity: number;
  status: VehicleStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVehicleInput {
  registrationNumber: string;
  type: string;
  capacity: number;
  status?: VehicleStatus;
}

export interface UpdateVehicleInput {
  registrationNumber?: string;
  type?: string;
  capacity?: number;
  status?: VehicleStatus;
}

export interface DriverRecord {
  id: string;
  organizationId: string;
  employeeId: string;
  licenseNumber: string;
  licenseExpiry: string;
  createdAt: string;
  updatedAt: string;
  employee: Employee;
}

export interface CreateDriverInput {
  employeeId: string;
  licenseNumber: string;
  licenseExpiry: string;
}

export interface UpdateDriverInput {
  employeeId?: string;
  licenseNumber?: string;
  licenseExpiry?: string;
}

export interface StopRecord {
  id: string;
  organizationId: string;
  routeId: string;
  name: string;
  sequence: number;
  arrivalOffsetMinutes: number | null;
  latitude: string | null;
  longitude: string | null;
}

export interface AddStopInput {
  name: string;
  sequence: number;
  arrivalOffsetMinutes?: number;
  latitude?: number;
  longitude?: number;
}

export interface RouteRecord {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  vehicleId: string | null;
  driverId: string | null;
  createdAt: string;
  updatedAt: string;
  vehicle: VehicleRecord | null;
  driver: Employee | null;
  stops: StopRecord[];
}

export interface CreateRouteInput {
  name: string;
  code: string;
  vehicleId?: string;
  driverId?: string;
}

export interface UpdateRouteInput {
  name?: string;
  code?: string;
  vehicleId?: string;
  driverId?: string;
}

export interface AssignStudentTransportInput {
  studentEnrollmentId: string;
  routeId: string;
  stopId: string;
}

export interface StudentTransportAssignmentRecord {
  id: string;
  organizationId: string;
  studentEnrollmentId: string;
  routeId: string;
  stopId: string;
  assignedAt: string;
  // Only student/id/status fields are actually fetched here — not the
  // full StudentEnrollment shape (no program/section/term include).
  studentEnrollment: { id: string; studentId: string; status: EnrollmentStatus; student: Student };
  route: RouteRecord;
  stop: StopRecord;
}

// Transport, part 2: driver location + navigation (Phase 7 slice 7d-2).
export interface VehicleTrackingEventRecord {
  id: string;
  organizationId: string;
  vehicleId: string;
  routeId: string | null;
  latitude: string;
  longitude: string;
  recordedAt: string;
}

export interface VehicleTrackingEventWithVehicle extends VehicleTrackingEventRecord {
  vehicle: VehicleRecord;
}

export interface SubmitTrackingInput {
  routeId: string;
  latitude: number;
  longitude: number;
}

export interface DriverPortalDriver {
  id: string;
  organizationId: string;
  employeeId: string;
  licenseNumber: string;
  licenseExpiry: string;
  employee: Employee;
}

export interface DriverPortalMe {
  driver: DriverPortalDriver;
  route: RouteRecord | null;
}

export interface CreateEmployeeLoginInput {
  password: string;
}

// Never includes the password back — it was supplied by the admin, not
// generated. `username` is what the admin relays to the employee.
export interface CreateEmployeeLoginResult extends SafeUser {
  username: string;
}

// Teacher self-service portal — same self-service pattern as
// student-portal/driver-portal; teacherDashboard is the exact same
// aggregate the admin-facing dashboards endpoint returns, just scoped
// server-side to the caller's own Employee row.
export type TeacherPortalMe = TeacherDashboard;

export interface TeacherPortalClassToday {
  classSchedule: ClassSchedule;
  classSession: ClassSession | null;
}

// No learningObjectives include on this endpoint's query — narrower
// than SyllabusNode, not lying about the shape.
export type TeacherPortalSyllabusNode = Omit<SyllabusNode, "learningObjectives">;

// Course modules & content (LMS discovery slice 2). "Course" =
// TeachingAssignment — see docs/LMS_NOTES.md for why no separate
// Course entity was introduced.
export type CourseModuleItemType = "PAGE" | "LINK" | "VIDEO" | "DOCUMENT";

export interface CourseModuleItemRecord {
  id: string;
  organizationId: string;
  moduleId: string;
  sequence: number;
  title: string;
  type: CourseModuleItemType;
  content: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CourseModuleRecord {
  id: string;
  organizationId: string;
  teachingAssignmentId: string;
  title: string;
  description: string | null;
  sequence: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  items: CourseModuleItemRecord[];
}

export interface CreateCourseModuleInput {
  teachingAssignmentId: string;
  title: string;
  description?: string;
  sequence: number;
}

export interface UpdateCourseModuleInput {
  title?: string;
  description?: string;
  sequence?: number;
  isPublished?: boolean;
}

export interface CreateCourseModuleItemInput {
  sequence: number;
  title: string;
  type: CourseModuleItemType;
  content: string;
}

export interface UpdateCourseModuleItemInput {
  title?: string;
  content?: string;
  sequence?: number;
  isPublished?: boolean;
}

// Student-portal's own courses/modules views.
export type StudentPortalCourse = TeachingAssignment;

export interface StudentPortalModuleItem extends CourseModuleItemRecord {
  completed: boolean;
}

export interface StudentPortalModule extends Omit<CourseModuleRecord, "items"> {
  items: StudentPortalModuleItem[];
}

// Persistent, in-app notifications (LMS discovery slice 9) — one
// shared shape/endpoint set for every role, keyed by the caller's own
// User.id.
export interface Notification {
  id: string;
  organizationId: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

// File uploads (LMS discovery slice 8) — the returned `url` is exactly
// what gets stored in any of this project's existing "just a URL
// string" attachment fields (ClassMaterial.url, CourseModuleItem.
// content, AssignmentSubmission.content); which storage backend
// actually produced it is configured server-side and never visible
// here.
export interface UploadResult {
  url: string;
  key: string;
}

// ── Hostel (Phase 7 slice 7e) ───────────────────────────────────────

export type HostelBedStatus = "AVAILABLE" | "MAINTENANCE";
export type HostelAttendanceStatus = "PRESENT" | "ABSENT" | "ON_LEAVE";
export type HostelComplaintStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";
export type HostelMaintenanceStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";

export interface HostelBedRecord {
  id: string;
  organizationId: string;
  roomId: string;
  label: string;
  status: HostelBedStatus;
}

export interface HostelRoomRecord {
  id: string;
  organizationId: string;
  buildingId: string;
  roomNumber: string;
  roomType: string | null;
  beds: HostelBedRecord[];
}

export interface HostelBuildingRecord {
  id: string;
  organizationId: string;
  hostelId: string;
  name: string;
  code: string;
  rooms: HostelRoomRecord[];
}

export interface HostelRecord {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  address: string | null;
  buildings: HostelBuildingRecord[];
}

export interface CreateHostelInput {
  name: string;
  code: string;
  address?: string;
}

export interface CreateHostelBuildingInput {
  hostelId: string;
  name: string;
  code: string;
}

export interface CreateHostelRoomInput {
  buildingId: string;
  roomNumber: string;
  roomType?: string;
}

export interface CreateHostelBedInput {
  roomId: string;
  label: string;
}

export interface UpdateHostelBedInput {
  status?: HostelBedStatus;
}

// A vacant bed's own record, with its full room -> building -> hostel
// chain, for the allocation form's picker.
export interface VacantHostelBedRecord extends HostelBedRecord {
  room: HostelRoomRecord & { building: HostelBuildingRecord & { hostel: HostelRecord } };
}

export interface AllocateHostelBedInput {
  studentEnrollmentId: string;
  bedId: string;
}

export interface HostelAllocationRecord {
  id: string;
  organizationId: string;
  studentEnrollmentId: string;
  bedId: string;
  allocatedAt: string;
  studentEnrollment: { id: string; studentId: string; status: EnrollmentStatus; student: Student };
  bed: VacantHostelBedRecord;
}

export interface MarkHostelAttendanceInput {
  date: string;
  status: HostelAttendanceStatus;
}

export interface HostelAttendanceRecord {
  id: string;
  organizationId: string;
  hostelAllocationId: string;
  date: string;
  status: HostelAttendanceStatus;
  markedAt: string;
}

export interface LogHostelVisitorInput {
  visitorName: string;
  relation?: string;
}

export interface HostelVisitorRecord {
  id: string;
  organizationId: string;
  hostelAllocationId: string;
  visitorName: string;
  relation: string | null;
  checkInAt: string;
  checkOutAt: string | null;
}

export interface CreateHostelComplaintInput {
  category: string;
  description: string;
}

export interface UpdateHostelComplaintInput {
  status: HostelComplaintStatus;
  resolutionNotes?: string;
}

export interface HostelComplaintRecord {
  id: string;
  organizationId: string;
  hostelAllocationId: string;
  category: string;
  description: string;
  status: HostelComplaintStatus;
  raisedAt: string;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  hostelAllocation: HostelAllocationRecord;
}

export interface CreateHostelMaintenanceRequestInput {
  roomId: string;
  description: string;
}

export interface UpdateHostelMaintenanceRequestInput {
  status: HostelMaintenanceStatus;
}

export interface HostelMaintenanceRequestRecord {
  id: string;
  organizationId: string;
  roomId: string;
  description: string;
  status: HostelMaintenanceStatus;
  reportedAt: string;
  resolvedAt: string | null;
  room: HostelRoomRecord & { building: HostelBuildingRecord & { hostel: HostelRecord } };
}

// Standardization lookups (room type / visitor relation / complaint
// category) — one small org-scoped catalog, not three near-identical
// ones. See the `HostelLookup` model comment in schema.prisma for why.
export type HostelLookupKind = "ROOM_TYPE" | "VISITOR_RELATION" | "COMPLAINT_CATEGORY";

export interface CreateHostelLookupInput {
  kind: HostelLookupKind;
  name: string;
}

// kind is intentionally not editable after creation — renaming what
// "kind" an in-use lookup belongs to would be confusing since the
// referencing rows just store a free-text name (see HostelLookup's
// own schema comment), only the display name is meant to change.
export interface UpdateHostelLookupInput {
  name?: string;
}

export interface HostelLookupRecord {
  id: string;
  organizationId: string;
  kind: HostelLookupKind;
  name: string;
  createdAt: string;
}

// ── Inventory (Phase 7 slice 7f) ────────────────────────────────────
export type PurchaseOrderStatus = "DRAFT" | "ORDERED" | "RECEIVED" | "CANCELLED";
export type StockMovementType = "IN" | "OUT" | "ADJUSTMENT";
export type AssetStatus = "AVAILABLE" | "MAINTENANCE" | "RETIRED";

export interface CreateInventoryCategoryInput {
  name: string;
  code: string;
}

export interface UpdateInventoryCategoryInput {
  name?: string;
  code?: string;
}

export interface InventoryCategoryRecord {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  createdAt: string;
}

export interface CreateSupplierInput {
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface UpdateSupplierInput {
  name?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface SupplierRecord {
  id: string;
  organizationId: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  createdAt: string;
}

export interface CreateInventoryItemInput {
  categoryId: string;
  name: string;
  sku: string;
  unit: string;
  barcode?: string;
  reorderLevel?: number;
}

export interface InventoryItemRecord {
  id: string;
  organizationId: string;
  categoryId: string;
  name: string;
  sku: string;
  unit: string;
  barcode: string | null;
  reorderLevel: number | null;
  createdAt: string;
  updatedAt: string;
  category: InventoryCategoryRecord;
  currentStock: number;
}

export interface CreatePurchaseOrderInput {
  supplierId: string;
  notes?: string;
}

export interface AddPurchaseOrderItemInput {
  itemId: string;
  quantityOrdered: number;
  unitPrice: number;
}

export interface PurchaseOrderItemRecord {
  id: string;
  organizationId: string;
  purchaseOrderId: string;
  itemId: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitPrice: string;
  item: InventoryItemRecord;
}

export interface PurchaseOrderRecord {
  id: string;
  organizationId: string;
  supplierId: string;
  status: PurchaseOrderStatus;
  orderDate: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  supplier: SupplierRecord;
  items: PurchaseOrderItemRecord[];
}

export interface ReceivePurchaseOrderInput {
  lines: { purchaseOrderItemId: string; quantity: number }[];
}

export interface CreateStockAdjustmentInput {
  itemId: string;
  quantity: number;
  reason?: string;
}

export interface StockMovementRecord {
  id: string;
  organizationId: string;
  itemId: string;
  type: StockMovementType;
  quantity: number;
  reason: string | null;
  purchaseOrderId: string | null;
  movementDate: string;
  item: InventoryItemRecord;
}

export interface CreateAssetInput {
  categoryId?: string;
  assetTag: string;
  name: string;
  purchaseDate?: string;
  purchaseCost?: number;
}

export interface UpdateAssetInput {
  status: AssetStatus;
}

export interface AssetAssignmentRecord {
  id: string;
  organizationId: string;
  assetId: string;
  assignedToEmployeeId: string;
  assignedAt: string;
  returnedAt: string | null;
  notes: string | null;
  asset?: AssetRecord;
  assignedToEmployee: Employee;
}

export interface AssetRecord {
  id: string;
  organizationId: string;
  categoryId: string | null;
  assetTag: string;
  name: string;
  purchaseDate: string | null;
  purchaseCost: string | null;
  status: AssetStatus;
  createdAt: string;
  updatedAt: string;
  category: InventoryCategoryRecord | null;
  assignments: AssetAssignmentRecord[];
}

export interface AssignAssetInput {
  assetId: string;
  employeeId: string;
  notes?: string;
}

// ── Communication (Phase 7 slice 7g) ────────────────────────────────
// `announcements` (course-scoped teacher posts) and `notifications`
// (in-app per-user) already exist from the LMS slices and are reused
// as-is here, not rebuilt — see the `Message` schema comment for why.
export type MessageChannel = "IN_APP" | "EMAIL" | "SMS" | "PUSH";
export type MessageAudience = "ALL_STAFF" | "ALL_STUDENTS" | "ALL_GUARDIANS" | "SPECIFIC_USER";
export type MessageStatus = "DRAFT" | "SENT" | "FAILED";
export type DeliveryStatus = "SENT" | "FAILED";

export interface CreateMessageTemplateInput {
  name: string;
  channel: MessageChannel;
  subject?: string;
  body: string;
}

export interface UpdateMessageTemplateInput {
  name?: string;
  channel?: MessageChannel;
  subject?: string;
  body?: string;
}

export interface MessageTemplateRecord {
  id: string;
  organizationId: string;
  name: string;
  channel: MessageChannel;
  subject: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMessageInput {
  channel: MessageChannel;
  audience: MessageAudience;
  recipientUserId?: string;
  templateId?: string;
  subject?: string;
  body?: string;
}

export interface MessageUserSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface EmailLogRecord {
  id: string;
  organizationId: string;
  messageId: string;
  recipientEmail: string;
  recipientName: string | null;
  status: DeliveryStatus;
  providerResponse: string | null;
  sentAt: string;
}

export interface SmsLogRecord {
  id: string;
  organizationId: string;
  messageId: string;
  recipientPhone: string;
  recipientName: string | null;
  status: DeliveryStatus;
  providerResponse: string | null;
  sentAt: string;
}

export interface PushNotificationLogRecord {
  id: string;
  organizationId: string;
  messageId: string;
  recipientUserId: string;
  status: DeliveryStatus;
  providerResponse: string | null;
  sentAt: string;
}

export interface MessageRecord {
  id: string;
  organizationId: string;
  createdByUserId: string;
  templateId: string | null;
  channel: MessageChannel;
  audience: MessageAudience;
  recipientUserId: string | null;
  subject: string | null;
  body: string;
  status: MessageStatus;
  sentAt: string | null;
  createdAt: string;
  template: MessageTemplateRecord | null;
  createdBy: MessageUserSummary;
  recipientUser: MessageUserSummary | null;
  emailLogs: EmailLogRecord[];
  smsLogs: SmsLogRecord[];
  pushLogs: PushNotificationLogRecord[];
}

export interface MessageRecipientPreview {
  recipientCount: number;
  unresolvable: boolean;
}

// ── Documents & Certificates (Phase 7h) ─────────────────────────────
export type DocumentReviewStatus = "PENDING" | "VERIFIED" | "REJECTED";
export type CertificateStatus = "ISSUED" | "REVOKED";

export interface CreateStudentDocumentInput {
  studentId: string;
  documentType: string;
  fileUrl: string;
}

export interface UploadOwnDocumentInput {
  documentType: string;
  fileUrl: string;
}

export interface ReviewDocumentInput {
  status: "VERIFIED" | "REJECTED";
  reviewNotes?: string;
}

export interface StudentDocumentRecord {
  id: string;
  organizationId: string;
  studentId: string;
  documentType: string;
  fileUrl: string;
  status: DocumentReviewStatus;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  uploadedAt: string;
  student?: Student;
}

export interface CreateStaffDocumentInput {
  employeeId: string;
  documentType: string;
  fileUrl: string;
}

export interface StaffDocumentRecord {
  id: string;
  organizationId: string;
  employeeId: string;
  documentType: string;
  fileUrl: string;
  status: DocumentReviewStatus;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  uploadedAt: string;
  employee?: Employee;
}

export interface CreateCertificateInput {
  studentId: string;
  type: string;
  fileUrl: string;
}

export interface RevokeCertificateInput {
  reason?: string;
}

export interface CertificateRecord {
  id: string;
  organizationId: string;
  studentId: string;
  type: string;
  issuedAt: string;
  issuedByUserId: string;
  fileUrl: string;
  verificationCode: string;
  status: CertificateStatus;
  revokedAt: string | null;
  revokedReason: string | null;
  student?: Student;
}

export interface PublicCertificateVerification {
  studentName: string;
  type: string;
  issuedAt: string;
  status: CertificateStatus;
  revokedAt: string | null;
}

// ── Alumni & Career, part 1 (Phase 8 slice 8a) ──────────────────────
export interface CreateAlumniProfileInput {
  studentId: string;
  graduationYear: number;
  currentOccupation?: string;
  currentEmployer?: string;
  currentLocation?: string;
  bio?: string;
  linkedinUrl?: string;
}

export interface UpdateAlumniProfileInput {
  currentOccupation?: string;
  currentEmployer?: string;
  currentLocation?: string;
  bio?: string;
  linkedinUrl?: string;
  isPubliclyVisible?: boolean;
}

export interface AlumniCompanyRecord {
  id: string;
  organizationId: string;
  name: string;
  industry: string | null;
  website: string | null;
  createdAt: string;
}

export interface CreateAlumniCompanyInput {
  name: string;
  industry?: string;
  website?: string;
}

export interface AlumniEducationRecord {
  id: string;
  organizationId: string;
  alumniProfileId: string;
  institutionName: string;
  degree: string;
  fieldOfStudy: string | null;
  startYear: number | null;
  endYear: number | null;
  notes: string | null;
  createdAt: string;
}

export interface CreateAlumniEducationInput {
  institutionName: string;
  degree: string;
  fieldOfStudy?: string;
  startYear?: number;
  endYear?: number;
  notes?: string;
}

export interface AlumniCareerHistoryRecord {
  id: string;
  organizationId: string;
  alumniProfileId: string;
  companyId: string;
  jobTitle: string;
  startDate: string;
  endDate: string | null;
  description: string | null;
  createdAt: string;
  company: AlumniCompanyRecord;
}

export interface CreateAlumniCareerHistoryInput {
  companyId: string;
  jobTitle: string;
  startDate: string;
  endDate?: string;
  description?: string;
}

export interface UpdateAlumniCareerHistoryInput {
  endDate: string;
}

export interface AlumniSkillRecord {
  id: string;
  organizationId: string;
  alumniProfileId: string;
  skillName: string;
  createdAt: string;
}

export interface CreateAlumniSkillInput {
  skillName: string;
}

export interface AlumniCertificationRecord {
  id: string;
  organizationId: string;
  alumniProfileId: string;
  name: string;
  issuingOrganization: string | null;
  issuedDate: string | null;
  expiryDate: string | null;
  credentialUrl: string | null;
  createdAt: string;
}

export interface CreateAlumniCertificationInput {
  name: string;
  issuingOrganization?: string;
  issuedDate?: string;
  expiryDate?: string;
  credentialUrl?: string;
}

export interface AlumniProfileRecord {
  id: string;
  organizationId: string;
  studentId: string;
  graduationYear: number;
  currentOccupation: string | null;
  currentEmployer: string | null;
  currentLocation: string | null;
  bio: string | null;
  linkedinUrl: string | null;
  isPubliclyVisible: boolean;
  createdAt: string;
  updatedAt: string;
  student: Student;
  education: AlumniEducationRecord[];
  careerHistory: AlumniCareerHistoryRecord[];
  skills: AlumniSkillRecord[];
  certifications: AlumniCertificationRecord[];
  achievements: AlumniAchievementRecord[];
  graduateOutcome: GraduateOutcomeRecord | null;
}

// ── Phase 8 slice 8b — Alumni engagement ──────────────────────────

export type SurveyQuestionType = "TEXT" | "RATING" | "SINGLE_CHOICE";

export interface SurveyQuestion {
  id: string;
  text: string;
  type: SurveyQuestionType;
  options?: string[];
}

export type AlumniSurveyStatus = "DRAFT" | "PUBLISHED" | "CLOSED";

export interface AlumniSurveyRecord {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  questions: SurveyQuestion[];
  status: AlumniSurveyStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAlumniSurveyInput {
  title: string;
  description?: string;
  questions: SurveyQuestion[];
}

export interface UpdateAlumniSurveyInput {
  title?: string;
  description?: string;
  questions?: SurveyQuestion[];
}

export interface SurveyAnswer {
  questionId: string;
  value: string;
}

export interface SubmitAlumniSurveyResponseInput {
  answers: SurveyAnswer[];
}

export interface AlumniSurveyResponseRecord {
  id: string;
  organizationId: string;
  surveyId: string;
  alumniProfileId: string;
  answers: SurveyAnswer[];
  submittedAt: string;
  alumniProfile?: AlumniProfileRecord;
}

export type MentorshipStatus = "REQUESTED" | "ACTIVE" | "DECLINED" | "COMPLETED";

export interface AlumniMentorshipRecord {
  id: string;
  organizationId: string;
  mentorAlumniProfileId: string;
  menteeStudentId: string;
  topic: string | null;
  status: MentorshipStatus;
  notes: string | null;
  requestedAt: string;
  respondedAt: string | null;
  completedAt: string | null;
  mentorAlumniProfile?: AlumniProfileRecord;
  menteeStudent?: Student;
}

export interface CreateAlumniMentorshipInput {
  mentorAlumniProfileId: string;
  menteeStudentId: string;
  topic?: string;
}

export interface RespondAlumniMentorshipInput {
  status: "ACTIVE" | "DECLINED";
}

export interface AlumniAchievementRecord {
  id: string;
  organizationId: string;
  alumniProfileId: string;
  title: string;
  description: string | null;
  achievedAt: string | null;
  createdAt: string;
}

export interface CreateAlumniAchievementInput {
  title: string;
  description?: string;
  achievedAt?: string;
}

// ── Phase 8 slice 8c — Career services ────────────────────────────

export type OpportunityType = "JOB" | "INTERNSHIP";
export type OpportunityStatus = "PENDING" | "APPROVED" | "REJECTED" | "CLOSED";

export interface CareerOpportunityRecord {
  id: string;
  organizationId: string;
  postedByAlumniProfileId: string | null;
  companyId: string;
  title: string;
  type: OpportunityType;
  description: string;
  location: string | null;
  status: OpportunityStatus;
  createdAt: string;
  updatedAt: string;
  company: AlumniCompanyRecord;
  postedByAlumniProfile?: AlumniProfileRecord | null;
}

export interface CreateOpportunityInput {
  companyId: string;
  title: string;
  type: OpportunityType;
  description: string;
  location?: string;
}

export interface ReviewOpportunityInput {
  status: "APPROVED" | "REJECTED";
}

export type ApplicationStatus = "SUBMITTED" | "UNDER_REVIEW" | "SHORTLISTED" | "REJECTED" | "ACCEPTED" | "WITHDRAWN";

export interface CareerApplicationRecord {
  id: string;
  organizationId: string;
  opportunityId: string;
  applicantStudentId: string;
  status: ApplicationStatus;
  coverNote: string | null;
  reviewNotes: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  applicantStudent?: Student;
  opportunity?: CareerOpportunityRecord;
}

export interface CreateApplicationInput {
  coverNote?: string;
}

export interface UpdateApplicationStatusInput {
  status: "UNDER_REVIEW" | "SHORTLISTED" | "REJECTED" | "ACCEPTED";
  reviewNotes?: string;
}

export interface CareerServiceRecord {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreateCareerServiceInput {
  name: string;
  description?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface UpdateCareerServiceInput {
  name?: string;
  description?: string;
  contactEmail?: string;
  contactPhone?: string;
  isActive?: boolean;
}

export type EmploymentStatus =
  | "EMPLOYED"
  | "SELF_EMPLOYED"
  | "FURTHER_STUDY"
  | "UNEMPLOYED_SEEKING"
  | "UNEMPLOYED_NOT_SEEKING"
  | "UNKNOWN";

export interface GraduateOutcomeRecord {
  id: string;
  organizationId: string;
  alumniProfileId: string;
  employmentStatus: EmploymentStatus;
  employerOrInstitution: string | null;
  fieldRelatedToStudy: boolean | null;
  notes: string | null;
  recordedAt: string;
  updatedAt: string;
}

export interface SetGraduateOutcomeInput {
  employmentStatus: EmploymentStatus;
  employerOrInstitution?: string;
  fieldRelatedToStudy?: boolean;
  notes?: string;
}

// ── Phase 8 slice 8d, part 1 — Analytics & Reports ────────────────

export interface OperationalAnalytics {
  activeStudents: number;
  activeStaff: number;
  activeEnrollments: number;
  outstandingAmount: number;
}

export interface AcademicAnalytics {
  enrollmentByProgram: { name: string; count: number }[];
  enrollmentBySection: { name: string; count: number }[];
  gradeDistribution: {
    examId: string | null;
    examName: string | null;
    bands: { grade: string; count: number }[];
  };
}

export interface AttendanceAnalytics {
  from: string;
  to: string;
  overallRate: number | null;
  totalMarked: number;
  bySection: { name: string; rate: number | null; present: number; total: number }[];
}

export interface EnrollmentAnalytics {
  admissionsFunnel: { status: string; count: number }[];
  enrollmentTrend: { academicYear: string; count: number }[];
}

// ── Phase 8 slice 8d, part 2 ───────────────────────────────────────

export interface FinancialAnalytics {
  totalInvoiced: number;
  totalCollected: number;
  totalDiscounted: number;
  totalOutstanding: number;
  collectionsByMethod: { method: string; amount: number }[];
}

export interface ExaminationAnalytics {
  attemptsScored: number;
  passRate: number | null;
  averagePercentage: number | null;
  gradeDistribution: { grade: string; count: number }[];
}

export interface ContinuousLearningAnalytics {
  totalSubmissions: number;
  gradedSubmissions: number;
  submissionGradedRate: number | null;
  totalQuizAttempts: number;
  averageQuizScore: number | null;
}

export interface AlumniOutcomesAnalytics {
  totalAlumni: number;
  outcomesRecorded: number;
  employmentStatus: { status: string; count: number }[];
}

export type AnalyticsExportFormat = "csv" | "xlsx" | "pdf";

// Global search (Phase 8, part 1 — people only: students, staff,
// guardians). Each category is independently omitted server-side if
// the caller lacks that resource's view permission, never a 403.
export interface StudentSearchResult {
  id: string;
  studentCode: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
}

export interface EmployeeSearchResult {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  photoUrl: string | null;
}

export interface GuardianSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
}

export interface VehicleSearchResult {
  id: string;
  registrationNumber: string;
  type: string;
}

export interface InventoryItemSearchResult {
  id: string;
  name: string;
  sku: string;
}

export interface ExamSearchResult {
  id: string;
  name: string;
}

export interface SearchResult {
  students: StudentSearchResult[];
  employees: EmployeeSearchResult[];
  guardians: GuardianSearchResult[];
  vehicles: VehicleSearchResult[];
  inventoryItems: InventoryItemSearchResult[];
  exams: ExamSearchResult[];
}

// Phase 8 performance-optimization slice — shared envelope every
// paginated list endpoint returns (students, employees, invoices).
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

// Self-hosted human-verification challenge — see CaptchaService.
export interface CaptchaChallenge {
  captchaId: string;
  svg: string;
}

// Structured error body a create-record call throws when the caller's
// org has hit its licensing edition's record cap — distinct from a
// generic error so the UI can render an upgrade banner instead of a
// toast. Thrown as a 403; check `error === "EDITION_LIMIT_EXCEEDED"`
// on the caught error's body.
export interface EditionLimitExceededError {
  error: "EDITION_LIMIT_EXCEEDED";
  edition: Edition;
  limit: number;
}

// Platform admin console (licensing editions) — a genuinely separate
// cross-org identity from every tenant-scoped type above; never mix
// its session with the tenant one.
export interface PlatformAdminUser {
  id: string;
  email: string;
  name: string;
}

export interface PlatformOrganizationSummary {
  id: string;
  name: string;
  slug: string;
  edition: Edition;
  studentCount: number;
  employeeCount: number;
  limit: number;
  atLimit: boolean;
}

export interface UpdateOrganizationInput {
  name?: string;
  slug?: string;
  edition?: Edition;
}

// ── Device Gateway (Phase 8, docx §12 "Biometric/Device Gateway") ──────────
// barcode/RFID/smart-card scan-in, used by apps/device-gateway-client.

export type GatewayDeviceType =
  | "BARCODE_SCANNER"
  | "RFID_READER"
  | "SMART_CARD_READER"
  | "FINGERPRINT_SCANNER"
  | "PRINTER";

export interface RegisterGatewayDeviceInput {
  name: string;
  deviceType: GatewayDeviceType;
  location?: string;
}

export interface GatewayDeviceRecord {
  id: string;
  organizationId: string;
  name: string;
  deviceType: GatewayDeviceType;
  location: string | null;
  // Set on every scan, same "healthy vs stale computed on read"
  // precedent as CameraRecord.lastSeenAt.
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type GatewayScanResultValue = "IDENTIFIED" | "NOT_FOUND";

export interface GatewayScanInput {
  rawCode: string;
}

export interface GatewayScanEventRecord {
  id: string;
  organizationId: string;
  deviceId: string;
  rawCode: string;
  matchedStudentId: string | null;
  matchedEmployeeId: string | null;
  result: GatewayScanResultValue;
  reconciledStudentAttendanceId: string | null;
  reconciledStaffAttendanceId: string | null;
  createdAt: string;
}

// POST devices/:id/scan's response shape — not just the created event,
// but a display-ready summary (matchedName) so a kiosk UI doesn't need
// a second lookup to show who was just identified.
export interface GatewayScanResult {
  result: GatewayScanResultValue;
  matchedName: string | null;
  reconciled: boolean;
  event: GatewayScanEventRecord;
}

export interface BindGatewayCardInput {
  rawCode: string;
  studentId?: string;
  staffId?: string;
}

export interface GatewayCardBindingRecord {
  id: string;
  organizationId: string;
  rawCode: string;
  studentId: string | null;
  staffId: string | null;
  boundAt: string;
  boundBy: string;
}

// listScanEvents' fuller shape — the recent-scans feed.
export interface GatewayScanEvent extends GatewayScanEventRecord {
  device: GatewayDeviceRecord;
  matchedStudent: { id: string; firstName: string; lastName: string; studentCode: string } | null;
  matchedEmployee: { id: string; firstName: string; lastName: string; employeeCode: string } | null;
}
