"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import { statusVariant } from "@/lib/status-variant";
import { useHighlightFromSearch } from "@/lib/use-highlight-from-search";
import type { AttendanceStatus, Student } from "@education-erp/api-client";

const ATTEMPT_STATUSES: AttendanceStatus[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

function errorMessage(err: unknown, fallback: string) {
  const message =
    err && typeof err === "object" && "body" in err
      ? ((err as { body?: { message?: string } }).body?.message ?? null)
      : null;
  return typeof message === "string" ? message : fallback;
}

async function submitAction(action: () => Promise<unknown>, onSuccess: () => void) {
  try {
    await action();
    onSuccess();
    toast.success("Saved");
  } catch (err) {
    toast.error(errorMessage(err, "Failed — check that required fields are filled in"));
  }
}

function AttemptAnswers({ examAttemptId }: { examAttemptId: string }) {
  const answers = useSWR(["exam-answers", examAttemptId], () => api.listExamAnswers(examAttemptId));
  if (!answers.data || answers.data.length === 0) {
    return <p className="text-muted-foreground mt-1 pl-4 text-xs">No answers recorded yet.</p>;
  }
  return (
    <ul className="text-muted-foreground mt-1 space-y-0.5 pl-4 text-xs">
      {answers.data.map((a) => (
        <li key={a.id}>
          {a.question.text} —{" "}
          {a.question.questionType === "OBJECTIVE"
            ? a.selectedOptionIndex !== null
              ? (a.question.options ?? [])[a.selectedOptionIndex]
              : "(no answer)"
            : (a.textAnswer ?? "(no answer)")}
          {a.score !== null ? ` — ${a.score}/${a.question.marks}` : " — not yet scored"}
        </li>
      ))}
    </ul>
  );
}

function ExamSubjectAttempts({
  examSubjectId,
  fullMarks,
  students,
}: {
  examSubjectId: string;
  fullMarks: number;
  students: Student[];
}) {
  const attempts = useSWR(["exam-attempts", examSubjectId], () => api.listExamAttempts(examSubjectId));
  const [attemptForm, setAttemptForm] = useState<{ studentId: string; status: AttendanceStatus }>({
    studentId: "",
    status: "PRESENT",
  });
  const [marksForms, setMarksForms] = useState<Record<string, string>>({});
  const [expandedAnswers, setExpandedAnswers] = useState<Record<string, boolean>>({});

  return (
    <div className="pl-4">
      <p className="text-muted-foreground text-xs font-medium">Attempts</p>
      {!attempts.data || attempts.data.length === 0 ? (
        <p className="text-muted-foreground text-xs">No attempts recorded yet.</p>
      ) : (
        <ul className="text-muted-foreground space-y-1 text-xs">
          {attempts.data.map((a) => {
            const canHaveMarks = a.status === "PRESENT" || a.status === "LATE";
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-2">
                {a.student.firstName} {a.student.lastName}
                <Badge variant={statusVariant(a.status)}>{a.status}</Badge>
                {a.startedAt ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="ml-2 h-6"
                    onClick={() => setExpandedAnswers((f) => ({ ...f, [a.id]: !f[a.id] }))}
                  >
                    {expandedAnswers[a.id] ? "Hide answers" : "View answers"}
                  </Button>
                ) : null}
                {a.marks ? (
                  <>
                    {` — ${a.marks.obtainedMarks}/${fullMarks}`}
                    {a.grade ? (
                      ` — ${a.grade.grade} (${a.grade.percentage.toFixed(1)}%)`
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="ml-2 h-6"
                        onClick={() =>
                          submitAction(
                            () => api.computeGrade(a.id),
                            () => attempts.mutate(),
                          )
                        }
                      >
                        Compute grade
                      </Button>
                    )}
                  </>
                ) : canHaveMarks ? (
                  <form
                    className="mt-1 flex items-end gap-2"
                    onSubmit={(e: FormEvent) => {
                      e.preventDefault();
                      const value = marksForms[a.id] ?? "";
                      submitAction(
                        () => api.recordMarks(a.id, { obtainedMarks: Number(value) }),
                        () => {
                          setMarksForms((f) => ({ ...f, [a.id]: "" }));
                          attempts.mutate();
                        },
                      );
                    }}
                  >
                    <Input
                      type="number"
                      className="h-7 w-20"
                      placeholder={`/ ${fullMarks}`}
                      value={marksForms[a.id] ?? ""}
                      onChange={(e) => setMarksForms((f) => ({ ...f, [a.id]: e.target.value }))}
                    />
                    <Button type="submit" size="sm" className="h-7" disabled={!(marksForms[a.id] ?? "")}>
                      Save marks
                    </Button>
                  </form>
                ) : null}
                {expandedAnswers[a.id] ? <AttemptAnswers examAttemptId={a.id} /> : null}
              </li>
            );
          })}
        </ul>
      )}
      <form
        className="mt-2 flex flex-wrap items-end gap-3"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          submitAction(
            () => api.recordExamAttempt(examSubjectId, attemptForm),
            () => {
              setAttemptForm({ studentId: "", status: "PRESENT" });
              attempts.mutate();
            },
          );
        }}
      >
        <div className="space-y-2">
          <Label className="text-xs">Student</Label>
          <NativeSelect
            className="w-40"
            placeholder="Select student"
            value={attemptForm.studentId}
            onChange={(v) => setAttemptForm((f) => ({ ...f, studentId: v }))}
            options={students.map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}` }))}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Status</Label>
          <NativeSelect
            className="w-32"
            placeholder="Select status"
            value={attemptForm.status}
            onChange={(v) => setAttemptForm((f) => ({ ...f, status: v as AttendanceStatus }))}
            options={ATTEMPT_STATUSES.map((s) => ({ value: s, label: s }))}
          />
        </div>
        <Button type="submit" size="sm" disabled={!attemptForm.studentId}>
          Record attempt
        </Button>
      </form>
    </div>
  );
}

function ReportCardSection({ examId, students }: { examId: string; students: Student[] }) {
  const [studentId, setStudentId] = useState("");
  const reportCard = useSWR(
    studentId ? ["report-card", examId, studentId] : null,
    () => api.getReportCard(examId, studentId),
    { shouldRetryOnError: false },
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Report card</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label>Student</Label>
            <NativeSelect
              className="w-56"
              placeholder="Select student"
              value={studentId}
              onChange={setStudentId}
              options={students.map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}` }))}
            />
          </div>
          {studentId ? (
            <Button
              type="button"
              onClick={() =>
                submitAction(
                  () => api.generateReportCard(examId, studentId),
                  () => reportCard.mutate(),
                )
              }
            >
              {reportCard.data ? "Regenerate" : "Generate"} report card
            </Button>
          ) : null}
        </div>

        {studentId && !reportCard.data ? (
          <p className="text-muted-foreground text-sm">No report card generated yet.</p>
        ) : reportCard.data ? (
          <div className="space-y-2 text-sm">
            <p className="font-medium">
              Overall: {reportCard.data.totalObtainedMarks}/{reportCard.data.totalFullMarks} (
              {reportCard.data.percentage.toFixed(1)}%) — {reportCard.data.overallGrade}
              {reportCard.data.overallGpa !== null ? ` (GPA ${reportCard.data.overallGpa})` : ""}
            </p>
            <ul className="text-muted-foreground list-disc pl-5">
              {reportCard.data.subjects.map((s) => (
                <li key={s.id}>
                  {s.examSubject.curriculumSubject.subject.name}: {s.marks.obtainedMarks}/
                  {s.examSubject.fullMarks} — {s.grade.grade}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function ExamsPage() {
  const examTypes = useSWR("exam-types", () => api.listExamTypes());
  const terms = useSWR("terms", () => api.listTerms());
  const gradingSchemes = useSWR("grading-schemes", () => api.listGradingSchemes());
  const curricula = useSWR("curricula", () => api.listCurricula());
  const rooms = useSWR("rooms", () => api.listRooms());
  const students = useSWR("students", () => api.listStudents());
  const questionBanks = useSWR("question-banks", () => api.listQuestionBanks());
  const exams = useSWR("exams", () => api.listExams());
  useHighlightFromSearch(Boolean(exams.data));

  const curriculumSubjectOptions = (curricula.data ?? []).flatMap((c) =>
    c.subjects.map((cs) => ({ value: cs.id, label: `${c.name} · ${cs.subject.name}` })),
  );

  const submit = submitAction;

  // --- Exams ---------------------------------------------------------------
  const [examForm, setExamForm] = useState({ examTypeId: "", termId: "", name: "", gradingSchemeId: "" });

  const [activeExamId, setActiveExamId] = useState<string | null>(null);
  const activeExam = useSWR(activeExamId ? ["exam", activeExamId] : null, () => api.getExam(activeExamId as string));

  // --- Exam subjects ---------------------------------------------------------
  const [subjectForm, setSubjectForm] = useState({
    curriculumSubjectId: "",
    fullMarks: "100",
    passMarks: "40",
    questionBankId: "",
  });

  // --- Schedule / room forms, keyed per exam subject --------------------------
  const [scheduleForms, setScheduleForms] = useState<Record<string, { date: string; startTime: string; endTime: string }>>(
    {},
  );
  const [roomForms, setRoomForms] = useState<Record<string, { roomId: string; capacity: string }>>({});

  function scheduleForm(examSubjectId: string) {
    return scheduleForms[examSubjectId] ?? { date: "", startTime: "", endTime: "" };
  }
  function roomForm(examScheduleId: string) {
    return roomForms[examScheduleId] ?? { roomId: "", capacity: "" };
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Exams</h1>
        <p className="text-muted-foreground text-sm">
          Bind slice 4a&apos;s exam types and grading schemes to a real sitting for a term — which
          subjects are examined, on which dates, and in which rooms.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Exams</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!exams.data || exams.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No exams yet.</p>
          ) : (
            <ul className="divide-y">
              {exams.data.map((e) => (
                <li id={`exam-${e.id}`} key={e.id} className="py-2 text-sm">
                  <button
                    type="button"
                    className="hover:text-primary text-left"
                    onClick={() => setActiveExamId(e.id)}
                  >
                    {e.name}{" "}
                    <span className="text-muted-foreground">
                      ({e.examType.name} · {e.term.name}
                      {e.gradingScheme ? ` · ${e.gradingScheme.name}` : ""})
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Separator />

          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              submit(
                () =>
                  api.createExam({
                    examTypeId: examForm.examTypeId,
                    termId: examForm.termId,
                    name: examForm.name,
                    gradingSchemeId: examForm.gradingSchemeId || undefined,
                  }),
                () => {
                  setExamForm({ examTypeId: "", termId: "", name: "", gradingSchemeId: "" });
                  exams.mutate();
                },
              );
            }}
          >
            <div className="space-y-2">
              <Label>Exam type</Label>
              <NativeSelect
                className="w-40"
                placeholder="Select type"
                value={examForm.examTypeId}
                onChange={(v) => setExamForm((f) => ({ ...f, examTypeId: v }))}
                options={(examTypes.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Term</Label>
              <NativeSelect
                className="w-40"
                placeholder="Select term"
                value={examForm.termId}
                onChange={(v) => setExamForm((f) => ({ ...f, termId: v }))}
                options={(terms.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                required
                className="w-48"
                value={examForm.name}
                onChange={(e) => setExamForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Grading scheme (optional)</Label>
              <NativeSelect
                className="w-48"
                placeholder="Select scheme"
                value={examForm.gradingSchemeId}
                onChange={(v) => setExamForm((f) => ({ ...f, gradingSchemeId: v }))}
                options={(gradingSchemes.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
              />
            </div>
            <Button type="submit" disabled={!examForm.examTypeId || !examForm.termId || !examForm.name}>
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      {activeExamId ? (
        <Card>
          <CardHeader>
            <CardTitle>{activeExam.data ? activeExam.data.name : "Loading…"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!activeExam.data ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : (
              <>
                {activeExam.data.examSubjects.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No subjects added yet.</p>
                ) : (
                  <div className="space-y-4">
                    {activeExam.data.examSubjects.map((es) => (
                      <div key={es.id} className="space-y-2 text-sm">
                        <p className="font-medium">
                          {es.curriculumSubject.subject.name}{" "}
                          <span className="text-muted-foreground">
                            (full {es.fullMarks}, pass {es.passMarks}){es.questionBankId ? " — Online" : ""}
                          </span>
                        </p>

                        {es.examSchedule ? (
                          <div className="pl-4">
                            <p className="text-muted-foreground">
                              {new Date(es.examSchedule.date).toLocaleDateString()} ·{" "}
                              {es.examSchedule.startTime}–{es.examSchedule.endTime}
                            </p>
                            {es.examSchedule.examRooms.length === 0 ? (
                              <p className="text-muted-foreground">No room assigned yet.</p>
                            ) : (
                              <ul className="text-muted-foreground list-disc pl-5">
                                {es.examSchedule.examRooms.map((r) => (
                                  <li key={r.id}>
                                    {r.room.name}
                                    {r.capacity ? ` (capacity ${r.capacity})` : ""}
                                  </li>
                                ))}
                              </ul>
                            )}
                            <form
                              className="mt-2 flex flex-wrap items-end gap-3"
                              onSubmit={(e: FormEvent) => {
                                e.preventDefault();
                                const scheduleId = es.examSchedule!.id;
                                const form = roomForm(scheduleId);
                                submit(
                                  () =>
                                    api.addExamRoom(scheduleId, {
                                      roomId: form.roomId,
                                      capacity: form.capacity ? Number(form.capacity) : undefined,
                                    }),
                                  () => {
                                    setRoomForms((f) => ({ ...f, [scheduleId]: { roomId: "", capacity: "" } }));
                                    activeExam.mutate();
                                  },
                                );
                              }}
                            >
                              <div className="space-y-2">
                                <Label className="text-xs">Room</Label>
                                <NativeSelect
                                  className="w-40"
                                  placeholder="Select room"
                                  value={roomForm(es.examSchedule.id).roomId}
                                  onChange={(v) =>
                                    setRoomForms((f) => ({
                                      ...f,
                                      [es.examSchedule!.id]: { ...roomForm(es.examSchedule!.id), roomId: v },
                                    }))
                                  }
                                  options={(rooms.data ?? []).map((r) => ({ value: r.id, label: r.name }))}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">Capacity (optional)</Label>
                                <Input
                                  type="number"
                                  className="w-24"
                                  value={roomForm(es.examSchedule.id).capacity}
                                  onChange={(e) =>
                                    setRoomForms((f) => ({
                                      ...f,
                                      [es.examSchedule!.id]: {
                                        ...roomForm(es.examSchedule!.id),
                                        capacity: e.target.value,
                                      },
                                    }))
                                  }
                                />
                              </div>
                              <Button type="submit" size="sm" disabled={!roomForm(es.examSchedule.id).roomId}>
                                Add room
                              </Button>
                            </form>
                          </div>
                        ) : (
                          <form
                            className="flex flex-wrap items-end gap-3 pl-4"
                            onSubmit={(e: FormEvent) => {
                              e.preventDefault();
                              const form = scheduleForm(es.id);
                              submit(
                                () =>
                                  api.createExamSchedule(es.id, {
                                    date: form.date,
                                    startTime: form.startTime,
                                    endTime: form.endTime,
                                  }),
                                () => {
                                  setScheduleForms((f) => ({ ...f, [es.id]: { date: "", startTime: "", endTime: "" } }));
                                  activeExam.mutate();
                                },
                              );
                            }}
                          >
                            <div className="space-y-2">
                              <Label className="text-xs">Date</Label>
                              <Input
                                type="date"
                                className="w-40"
                                value={scheduleForm(es.id).date}
                                onChange={(e) =>
                                  setScheduleForms((f) => ({
                                    ...f,
                                    [es.id]: { ...scheduleForm(es.id), date: e.target.value },
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Start (HH:mm)</Label>
                              <Input
                                className="w-24"
                                placeholder="09:00"
                                value={scheduleForm(es.id).startTime}
                                onChange={(e) =>
                                  setScheduleForms((f) => ({
                                    ...f,
                                    [es.id]: { ...scheduleForm(es.id), startTime: e.target.value },
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">End (HH:mm)</Label>
                              <Input
                                className="w-24"
                                placeholder="11:00"
                                value={scheduleForm(es.id).endTime}
                                onChange={(e) =>
                                  setScheduleForms((f) => ({
                                    ...f,
                                    [es.id]: { ...scheduleForm(es.id), endTime: e.target.value },
                                  }))
                                }
                              />
                            </div>
                            <Button
                              type="submit"
                              size="sm"
                              disabled={
                                !scheduleForm(es.id).date || !scheduleForm(es.id).startTime || !scheduleForm(es.id).endTime
                              }
                            >
                              Schedule
                            </Button>
                          </form>
                        )}

                        <ExamSubjectAttempts
                          examSubjectId={es.id}
                          fullMarks={es.fullMarks}
                          students={students.data ?? []}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <Separator />

                <form
                  className="flex flex-wrap items-end gap-3"
                  onSubmit={(e: FormEvent) => {
                    e.preventDefault();
                    if (!activeExamId) return;
                    submit(
                      () =>
                        api.addExamSubject(activeExamId, {
                          curriculumSubjectId: subjectForm.curriculumSubjectId,
                          fullMarks: Number(subjectForm.fullMarks),
                          passMarks: Number(subjectForm.passMarks),
                          questionBankId: subjectForm.questionBankId || undefined,
                        }),
                      () => {
                        setSubjectForm({ curriculumSubjectId: "", fullMarks: "100", passMarks: "40", questionBankId: "" });
                        activeExam.mutate();
                      },
                    );
                  }}
                >
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <NativeSelect
                      className="w-56"
                      placeholder="Select subject"
                      value={subjectForm.curriculumSubjectId}
                      onChange={(v) => setSubjectForm((f) => ({ ...f, curriculumSubjectId: v, questionBankId: "" }))}
                      options={curriculumSubjectOptions}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Full marks</Label>
                    <Input
                      type="number"
                      className="w-24"
                      value={subjectForm.fullMarks}
                      onChange={(e) => setSubjectForm((f) => ({ ...f, fullMarks: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Pass marks</Label>
                    <Input
                      type="number"
                      className="w-24"
                      value={subjectForm.passMarks}
                      onChange={(e) => setSubjectForm((f) => ({ ...f, passMarks: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Question bank (optional — for online delivery)</Label>
                    <NativeSelect
                      className="w-56"
                      placeholder="No question bank"
                      value={subjectForm.questionBankId}
                      onChange={(v) => setSubjectForm((f) => ({ ...f, questionBankId: v }))}
                      options={(questionBanks.data ?? [])
                        .filter((b) => b.curriculumSubjectId === subjectForm.curriculumSubjectId)
                        .map((b) => ({ value: b.id, label: b.name }))}
                    />
                  </div>
                  <Button type="submit" disabled={!subjectForm.curriculumSubjectId}>
                    Add subject
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {activeExamId ? <ReportCardSection examId={activeExamId} students={students.data ?? []} /> : null}
    </div>
  );
}
