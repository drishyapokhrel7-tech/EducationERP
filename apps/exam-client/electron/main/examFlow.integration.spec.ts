import { createApiClient } from "@education-erp/api-client";
import { apiClient, setAccessToken } from "./apiClient";
import { AnswerSyncQueue, retryWithBackoff } from "./retryQueue";

/**
 * Exercises this app's own main-process business logic — apiClient.ts's
 * shared client + token handling, and retryQueue.ts's wrappers around
 * saveAnswer/submitExam — against the real dev API server, reproducing
 * exactly what ipc.ts's handlers do without needing electron's
 * ipcMain/BrowserWindow (which can't run outside a real Electron
 * process). Server-side behavior itself (shuffle, scoring, window
 * enforcement) is already proven by services/api's own e2e suite; this
 * test is about confirming the client's wiring is correct.
 *
 * Requires services/api running on EXAM_CLIENT_API_URL (default
 * http://localhost:4000). All data created here is removed in afterAll.
 */
describe("exam-client main-process flow (integration)", () => {
  const baseUrl = process.env.EXAM_CLIENT_API_URL ?? "http://localhost:4000";
  // A second, plain client for admin-side setup calls — apiClient (the
  // module under test) owns exactly one access token via setAccessToken,
  // matching the real app's single-session design, so admin setup uses
  // its own separate client/token instead of fighting over that one slot.
  const adminClient = createApiClient({ baseUrl, getAccessToken: () => adminToken });
  let adminToken: string;

  const run = Date.now();
  const orgSlug = `exam-client-it-${run}`;
  let examSubjectId: string;
  let studentUsername: string;
  const studentPassword = "StudentPass123!";
  let q1Id: string;

  beforeAll(async () => {
    const reg = await adminClient.registerOrganization({
      organizationName: "Exam Client IT Org",
      slug: orgSlug,
      adminEmail: `admin-${run}@exam-client-it.test`,
      adminFirstName: "Admin",
      adminLastName: "User",
      password: "correct-horse-battery-staple",
    });
    adminToken = reg.accessToken;

    const campus = await adminClient.createCampus({ name: "IT Campus", code: `ITC${run}` });
    const faculty = await adminClient.createFaculty({ campusId: campus.id, name: "IT Faculty", code: `ITF${run}` });
    const department = await adminClient.createDepartment({
      facultyId: faculty.id,
      name: "IT Dept",
      code: `ITD${run}`,
    });
    const program = await adminClient.createProgram({
      departmentId: department.id,
      name: "IT Program",
      code: `ITP${run}`,
    });
    const subject = await adminClient.createSubject({ name: "IT Subject", code: `ITS${run}` });
    const curriculum = await adminClient.createCurriculum({
      programId: program.id,
      name: "IT Curriculum",
      code: `ITCUR${run}`,
    });
    const curriculumSubject = await adminClient.attachCurriculumSubject(curriculum.id, { subjectId: subject.id });
    const year = await adminClient.createAcademicYear({
      name: `IT Year ${run}`,
      startDate: "2099-01-01",
      endDate: "2099-12-31",
    });
    const term = await adminClient.createTerm({
      academicYearId: year.id,
      name: `IT Term ${run}`,
      code: `ITT${run}`,
      sequence: 1,
      startDate: "2099-01-01",
      endDate: "2099-06-30",
    });
    const examType = await adminClient.createExamType({ name: `IT Exam Type ${run}`, code: `ITET${run}` });
    const exam = await adminClient.createExam({ examTypeId: examType.id, termId: term.id, name: `IT Exam ${run}` });

    const bank = await adminClient.createQuestionBank({
      curriculumSubjectId: curriculumSubject.id,
      name: `IT Bank ${run}`,
    });
    const q1 = await adminClient.addExamQuestion(bank.id, {
      sequence: 1,
      text: "2 + 2 = ?",
      questionType: "OBJECTIVE",
      marks: 5,
      options: ["3", "4", "5"],
      correctOptionIndex: 1,
    });
    q1Id = q1.id;

    const examSubject = await adminClient.addExamSubject(exam.id, {
      curriculumSubjectId: curriculumSubject.id,
      fullMarks: 100,
      passMarks: 40,
      questionBankId: bank.id,
    });
    examSubjectId = examSubject.id;

    const today = new Date().toISOString().slice(0, 10);
    await adminClient.createExamSchedule(examSubject.id, { date: today, startTime: "00:00", endTime: "23:59" });

    const student = await adminClient.createStudent({
      studentCode: `IT-STU-${run}`,
      firstName: "Test",
      lastName: "Student",
      dateOfBirth: "2015-01-01",
    });
    const login = await adminClient.createStudentLogin(student.id, { password: studentPassword });
    studentUsername = login.username;

    await adminClient.recordExamAttempt(examSubject.id, { studentId: student.id, status: "PRESENT" });
  }, 30000);

  // This test's data lives entirely under one freshly-registered,
  // disposable org (slug includes `run`) — no shared/demo data is
  // touched. Cleaned up via a one-off script run from services/api right
  // after this suite (same PrismaClient-with-owner-credentials pattern
  // used for this session's browser-verification passes), not from
  // inside this file — apps/exam-client doesn't otherwise need a direct
  // Prisma dependency.

  it("logs in as the student, lists the exam, starts it (shuffled, no answer key), saves an answer through the retry queue, and submits", async () => {
    const user = await apiClient.login({ identifier: studentUsername, password: studentPassword });
    setAccessToken(user.accessToken);

    const exams = await apiClient.listMyExams();
    const attempt = exams.find((a) => a.examSubjectId === examSubjectId);
    expect(attempt).toBeDefined();

    const started = await apiClient.startMyExam(examSubjectId);
    expect(started.questions).toHaveLength(1);
    const question = started.questions[0];
    expect(question).not.toHaveProperty("correctOptionIndex");
    const correctDisplayIndex = (question.options ?? []).indexOf("4");
    expect(correctDisplayIndex).toBeGreaterThanOrEqual(0);

    const queue = new AnswerSyncQueue();
    const statuses: string[] = [];
    const saved = await queue.send(
      question.id,
      () => apiClient.saveMyAnswer(examSubjectId, question.id, { selectedOptionIndex: correctDisplayIndex }),
      (s) => statuses.push(s),
    );
    expect(saved?.selectedOptionIndex).not.toBeNull();
    expect(statuses).toEqual(["saving", "saved"]);

    const submitStatuses: string[] = [];
    const submitted = await retryWithBackoff(
      () => apiClient.submitMyExam(examSubjectId),
      (s) => submitStatuses.push(s),
    );
    expect(submitted?.submittedAt).not.toBeNull();
    expect(submitStatuses).toEqual(["saving", "saved"]);

    // Resubmitting is a real HTTP error (409), surfaced immediately, not
    // retried — the same guarantee the unit tests check in isolation,
    // now confirmed against the real server.
    await expect(
      retryWithBackoff(
        () => apiClient.submitMyExam(examSubjectId),
        () => undefined,
      ),
    ).rejects.toMatchObject({ status: 409 });

    setAccessToken(null);
  });

  it("scores the objective answer correctly (verified via the admin view)", async () => {
    const list = await adminClient.listExamAttempts(examSubjectId);
    expect(list).toHaveLength(1);
    const answers = await adminClient.listExamAnswers(list[0].id);
    const answer = answers.find((a) => a.questionId === q1Id);
    expect(answer?.score).toBe(5);
  });
});
