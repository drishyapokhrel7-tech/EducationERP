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

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export interface AttendanceSession {
  id: string;
  organizationId: string;
  classScheduleId: string;
  sectionId: string;
  date: string;
  section: Section;
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
  termId: string;
  name: string | null;
  description: string | null;
  curriculumSubject: CurriculumSubject & { subject: Subject; curriculum: Curriculum };
  term: Term;
}

export interface CreateSyllabusInput {
  curriculumSubjectId: string;
  termId: string;
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
  sectionId: string;
  date: string;
  lessonPlanId: string | null;
  actualSyllabusNodeId: string | null;
  progressNotes: string | null;
  status: ClassSessionStatus;
  completedAt: string | null;
  classSchedule: ClassSchedule;
  section: Section;
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

export interface CreateSubmissionInput {
  studentId: string;
  content?: string;
}

export interface GradeSubmissionInput {
  score: number;
  feedback?: string;
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
  answers: number[];
  score: number;
  submittedAt: string;
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
  termId: string;
  subject: Subject;
  section: Section;
  term: Term;
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
  termId: string;
  name: string;
  gradingSchemeId: string | null;
  createdAt: string;
  updatedAt: string;
  examType: ExamType;
  term: Term;
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
  createdAt: string;
  curriculumSubject: CurriculumSubject;
  examSchedule: ExamScheduleDetail | null;
}

export interface Exam extends ExamSummary {
  examSubjects: ExamSubjectDetail[];
}

export interface CreateExamInput {
  examTypeId: string;
  termId: string;
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
  createdAt: string;
}

export interface CreateExamSubjectInput {
  curriculumSubjectId: string;
  fullMarks: number;
  passMarks: number;
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
  createdAt: string;
  updatedAt: string;
}

// listAttempts' fuller shape — includes the student and any marks.
export interface ExamAttempt extends ExamAttemptRecord {
  student: StudentSummary;
  marks: MarksRecord | null;
}

export interface RecordExamAttemptInput {
  studentId: string;
  status: AttendanceStatus;
}

export interface RecordMarksInput {
  obtainedMarks: number;
  remarks?: string;
}
