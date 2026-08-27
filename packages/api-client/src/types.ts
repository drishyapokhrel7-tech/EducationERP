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
  // A User.email or a User.username — self-service logins (e.g.
  // students) use a username, not every login is email-shaped.
  identifier: string;
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
  // Set once a salary structure is assigned (Phase 7 slice 7b-2).
  salaryStructureId?: string | null;
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
  termId: string;
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
  termId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  program: Program;
  term: Term;
  items: FeeStructureItemRecord[];
}

export interface CreateFeeStructureInput {
  programId: string;
  termId: string;
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
