"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { ApiError } from "@education-erp/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { statusVariant } from "@/lib/status-variant";

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

export default function TeacherPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (mounted && !user) router.replace("/login");
  }, [mounted, user, router]);

  const me = useSWR("teacher-portal-me", () => api.getTeacherPortalMe(), { shouldRetryOnError: false });

  const [date, setDate] = useState(todayIso());
  const classes = useSWR(me.data ? ["teacher-classes-today", date] : null, () => api.teacherClassesToday(date));

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const activeSession = useSWR(
    activeSessionId ? ["teacher-class-session", activeSessionId] : null,
    () => api.getTeacherClassSession(activeSessionId as string),
  );
  const syllabusNodes = useSWR(
    activeSessionId ? ["teacher-syllabus-nodes", activeSessionId] : null,
    () => api.getTeacherSyllabusNodes(activeSessionId as string),
  );

  const [progressForm, setProgressForm] = useState({ actualSyllabusNodeId: "", progressNotes: "" });
  const [materialForm, setMaterialForm] = useState({ title: "", url: "", description: "" });

  async function openClass(classScheduleId: string) {
    try {
      const session = await api.createTeacherClassSession({ classScheduleId, date });
      classes.mutate();
      setActiveSessionId(session.id);
      setProgressForm({ actualSyllabusNodeId: "", progressNotes: "" });
      toast.success("Class opened");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to open class"));
    }
  }

  function selectExisting(sessionId: string) {
    setActiveSessionId(sessionId);
    setProgressForm({ actualSyllabusNodeId: "", progressNotes: "" });
  }

  if (!mounted || !user) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="flex items-center justify-between border-b p-4">
        <span className="font-semibold">Teacher</span>
        <Button variant="ghost" size="icon" onClick={() => logout().then(() => router.push("/login"))}>
          <LogOut className="size-4" />
        </Button>
      </header>
      <main className="flex-1 space-y-4 p-4">
        {me.error ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-sm">
                {me.error instanceof ApiError && me.error.status === 404
                  ? "This account isn't linked to a teaching record. Ask an admin to set one up."
                  : "Couldn't load your teaching profile — try reloading the page."}
              </p>
            </CardContent>
          </Card>
        ) : !me.data ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>
                  {me.data.employee.firstName} {me.data.employee.lastName}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {me.data.teachingAssignments.length === 0 ? (
                  <p className="text-muted-foreground">No teaching assignments yet.</p>
                ) : (
                  <p className="text-muted-foreground">
                    Teaching {me.data.teachingAssignments.map((t) => t.subject.name).join(", ")}
                  </p>
                )}
                {me.data.pendingGrading.length > 0 ? (
                  <p>
                    <Badge variant="warning">{me.data.pendingGrading.length}</Badge>{" "}
                    submission{me.data.pendingGrading.length === 1 ? "" : "s"} awaiting grading
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>My classes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input type="date" className="w-40" value={date} onChange={(e) => setDate(e.target.value)} />
                {!classes.data || classes.data.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No classes scheduled for this date.</p>
                ) : (
                  <ul className="divide-y">
                    {classes.data.map((entry) => (
                      <li key={entry.classSchedule.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span>
                          {DAYS[entry.classSchedule.dayOfWeek]} · {entry.classSchedule.period.name} —{" "}
                          {entry.classSchedule.teachingAssignment.subject.name} for {entry.classSchedule.section.name}{" "}
                          <span className="text-muted-foreground">({entry.classSchedule.room.name})</span>
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
                      <span className="text-muted-foreground ml-2 inline-flex items-center gap-2 text-sm font-normal">
                        <Badge variant={statusVariant(activeSession.data.status)}>{activeSession.data.status}</Badge>
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
                            await api.recordTeacherProgress(activeSessionId, {
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
                          <Label>Actual topic</Label>
                          <NativeSelect
                            className="w-56"
                            placeholder="Select topic"
                            value={progressForm.actualSyllabusNodeId}
                            onChange={(v) => setProgressForm((f) => ({ ...f, actualSyllabusNodeId: v }))}
                            options={(syllabusNodes.data ?? []).map((n) => ({
                              value: n.id,
                              label: `${n.level}: ${n.name}`,
                            }))}
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
                              await api.addTeacherClassMaterial(activeSessionId, {
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
                            await api.completeTeacherClassSession(activeSessionId);
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
          </>
        )}
      </main>
    </div>
  );
}
