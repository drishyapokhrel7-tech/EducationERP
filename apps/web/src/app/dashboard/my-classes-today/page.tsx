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

const DAYS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function errorMessage(err: unknown, fallback: string) {
  const message =
    err && typeof err === "object" && "body" in err
      ? ((err as { body?: { message?: string } }).body?.message ?? null)
      : null;
  return typeof message === "string" ? message : fallback;
}

export default function MyClassesTodayPage() {
  const [date, setDate] = useState(todayIso());
  const classes = useSWR(["my-classes-today", date], () => api.myClassesToday(date));

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const activeSession = useSWR(
    activeSessionId ? ["class-session", activeSessionId] : null,
    () => api.getClassSession(activeSessionId as string),
  );

  const [syllabusId, setSyllabusId] = useState("");
  const syllabi = useSWR("syllabi", () => api.listSyllabi());
  const syllabus = useSWR(syllabusId ? ["syllabus", syllabusId] : null, () => api.getSyllabus(syllabusId));

  const [progressForm, setProgressForm] = useState({ actualSyllabusNodeId: "", progressNotes: "" });
  const [materialForm, setMaterialForm] = useState({ title: "", url: "", description: "" });

  async function openClass(classScheduleId: string) {
    try {
      const session = await api.createClassSession({ classScheduleId, date });
      classes.mutate();
      setActiveSessionId(session.id);
      toast.success("Class opened");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to open class"));
    }
  }

  function selectExisting(sessionId: string) {
    setActiveSessionId(sessionId);
    setProgressForm({ actualSyllabusNodeId: "", progressNotes: "" });
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My Classes Today</h1>
        <p className="text-muted-foreground text-sm">
          Every scheduled class for the selected date. Open a class to record what was actually
          taught, add materials, and mark it completed.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Date</CardTitle>
        </CardHeader>
        <CardContent>
          <Input type="date" className="w-40" value={date} onChange={(e) => setDate(e.target.value)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scheduled classes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!classes.data || classes.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No classes scheduled for this date.</p>
          ) : (
            <ul className="divide-y">
              {classes.data.map((entry) => (
                <li key={entry.classSchedule.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>
                    {DAYS[entry.classSchedule.dayOfWeek]} · {entry.classSchedule.period.name} —{" "}
                    {entry.classSchedule.teachingAssignment.subject.name} for {entry.classSchedule.section.name}{" "}
                    <span className="text-muted-foreground">
                      ({entry.classSchedule.teachingAssignment.employee.firstName}{" "}
                      {entry.classSchedule.teachingAssignment.employee.lastName} · {entry.classSchedule.room.name})
                      {entry.attendanceMarked !== null ? ` · ${entry.attendanceMarked} attendance marks` : " · no attendance yet"}
                    </span>
                  </span>
                  {entry.classSession ? (
                    <Button type="button" variant="outline" onClick={() => selectExisting(entry.classSession!.id)}>
                      {entry.classSession.status}
                    </Button>
                  ) : (
                    <Button type="button" onClick={() => openClass(entry.classSchedule.id)}>
                      Open class
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {activeSessionId ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Class session
              {activeSession.data ? (
                <span className="text-muted-foreground ml-2 text-sm font-normal">
                  {activeSession.data.status} ·{" "}
                  {activeSession.data.actualSyllabusNode?.name ?? "no topic recorded yet"}
                </span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!activeSession.data ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : (
              <>
                <form
                  className="flex flex-wrap items-end gap-3"
                  onSubmit={async (e: FormEvent) => {
                    e.preventDefault();
                    if (!activeSessionId) return;
                    try {
                      await api.recordProgress(activeSessionId, {
                        actualSyllabusNodeId: progressForm.actualSyllabusNodeId || undefined,
                        progressNotes: progressForm.progressNotes || undefined,
                      });
                      activeSession.mutate();
                      classes.mutate();
                      toast.success("Saved");
                    } catch (err) {
                      toast.error(errorMessage(err, "Failed to record progress"));
                    }
                  }}
                >
                  <div className="space-y-2">
                    <Label>Syllabus</Label>
                    <NativeSelect
                      className="w-56"
                      placeholder="Select syllabus"
                      value={syllabusId}
                      onChange={(v) => {
                        setSyllabusId(v);
                        setProgressForm((f) => ({ ...f, actualSyllabusNodeId: "" }));
                      }}
                      options={(syllabi.data ?? []).map((s) => ({
                        value: s.id,
                        label: s.name || `${s.curriculumSubject.curriculum.name} · ${s.curriculumSubject.subject.name}`,
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Actual topic</Label>
                    <NativeSelect
                      className="w-56"
                      placeholder={syllabusId ? "Select topic" : "Select a syllabus first"}
                      value={progressForm.actualSyllabusNodeId}
                      onChange={(v) => setProgressForm((f) => ({ ...f, actualSyllabusNodeId: v }))}
                      options={(syllabus.data?.nodes ?? []).map((n) => ({
                        value: n.id,
                        label: `${n.level}: ${n.name}`,
                      }))}
                      disabled={!syllabusId}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Progress notes</Label>
                    <Input
                      className="w-56"
                      value={progressForm.progressNotes}
                      onChange={(e) => setProgressForm((f) => ({ ...f, progressNotes: e.target.value }))}
                    />
                  </div>
                  <Button type="submit">Save progress</Button>
                </form>

                <Separator />

                <div className="space-y-2">
                  <p className="text-sm font-medium">Materials</p>
                  {activeSession.data.materials.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No materials added yet.</p>
                  ) : (
                    <ul className="list-disc pl-5 text-sm">
                      {activeSession.data.materials.map((m) => (
                        <li key={m.id}>
                          {m.title}
                          {m.url ? (
                            <>
                              {" — "}
                              <a href={m.url} target="_blank" rel="noreferrer" className="underline">
                                link
                              </a>
                            </>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                  <form
                    className="flex flex-wrap items-end gap-3"
                    onSubmit={async (e: FormEvent) => {
                      e.preventDefault();
                      if (!activeSessionId) return;
                      try {
                        await api.addClassMaterial(activeSessionId, {
                          title: materialForm.title,
                          url: materialForm.url || undefined,
                          description: materialForm.description || undefined,
                        });
                        setMaterialForm({ title: "", url: "", description: "" });
                        activeSession.mutate();
                        toast.success("Saved");
                      } catch (err) {
                        toast.error(errorMessage(err, "Failed to add material"));
                      }
                    }}
                  >
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        required
                        className="w-40"
                        value={materialForm.title}
                        onChange={(e) => setMaterialForm((f) => ({ ...f, title: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>URL (optional)</Label>
                      <Input
                        className="w-48"
                        value={materialForm.url}
                        onChange={(e) => setMaterialForm((f) => ({ ...f, url: e.target.value }))}
                      />
                    </div>
                    <Button type="submit" disabled={!materialForm.title}>
                      Add material
                    </Button>
                  </form>
                </div>

                <Separator />

                <Button
                  type="button"
                  disabled={activeSession.data.status === "COMPLETED" || !activeSession.data.actualSyllabusNode}
                  onClick={async () => {
                    if (!activeSessionId) return;
                    try {
                      await api.completeClassSession(activeSessionId);
                      activeSession.mutate();
                      classes.mutate();
                      toast.success("Class marked completed");
                    } catch (err) {
                      toast.error(errorMessage(err, "Failed to complete class"));
                    }
                  }}
                >
                  {activeSession.data.status === "COMPLETED" ? "Completed" : "Mark completed"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
