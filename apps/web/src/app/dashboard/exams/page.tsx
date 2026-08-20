"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";

function errorMessage(err: unknown, fallback: string) {
  const message =
    err && typeof err === "object" && "body" in err
      ? ((err as { body?: { message?: string } }).body?.message ?? null)
      : null;
  return typeof message === "string" ? message : fallback;
}

export default function ExamsPage() {
  const examTypes = useSWR("exam-types", () => api.listExamTypes());
  const terms = useSWR("terms", () => api.listTerms());
  const gradingSchemes = useSWR("grading-schemes", () => api.listGradingSchemes());
  const curricula = useSWR("curricula", () => api.listCurricula());
  const rooms = useSWR("rooms", () => api.listRooms());
  const exams = useSWR("exams", () => api.listExams());

  const curriculumSubjectOptions = (curricula.data ?? []).flatMap((c) =>
    c.subjects.map((cs) => ({ value: cs.id, label: `${c.name} · ${cs.subject.name}` })),
  );

  async function submit(action: () => Promise<unknown>, onSuccess: () => void) {
    try {
      await action();
      onSuccess();
      toast.success("Saved");
    } catch (err) {
      toast.error(errorMessage(err, "Failed — check that required fields are filled in"));
    }
  }

  // --- Exams ---------------------------------------------------------------
  const [examForm, setExamForm] = useState({ examTypeId: "", termId: "", name: "", gradingSchemeId: "" });

  const [activeExamId, setActiveExamId] = useState<string | null>(null);
  const activeExam = useSWR(activeExamId ? ["exam", activeExamId] : null, () => api.getExam(activeExamId as string));

  // --- Exam subjects ---------------------------------------------------------
  const [subjectForm, setSubjectForm] = useState({ curriculumSubjectId: "", fullMarks: "100", passMarks: "40" });

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
                <li key={e.id} className="py-2 text-sm">
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
                            (full {es.fullMarks}, pass {es.passMarks})
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
                        }),
                      () => {
                        setSubjectForm({ curriculumSubjectId: "", fullMarks: "100", passMarks: "40" });
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
                      onChange={(v) => setSubjectForm((f) => ({ ...f, curriculumSubjectId: v }))}
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
                  <Button type="submit" disabled={!subjectForm.curriculumSubjectId}>
                    Add subject
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
