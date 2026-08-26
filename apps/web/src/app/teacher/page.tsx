"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { ApiError, type CourseModuleItemType, type SubmissionType } from "@education-erp/api-client";
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

  const [courseId, setCourseId] = useState("");
  const modules = useSWR(courseId ? ["teacher-modules", courseId] : null, () => api.listTeacherModules(courseId));
  const [moduleForm, setModuleForm] = useState({ title: "", description: "", sequence: "1" });
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<{ title: string; type: CourseModuleItemType; content: string; sequence: string }>({
    title: "",
    type: "PAGE",
    content: "",
    sequence: "1",
  });

  const assignments = useSWR(courseId ? ["teacher-assignments", courseId] : null, () => api.listTeacherAssignments(courseId));
  const [assignmentForm, setAssignmentForm] = useState<{
    title: string;
    description: string;
    submissionType: SubmissionType;
    dueDate: string;
    maxScore: string;
    allowResubmission: boolean;
  }>({ title: "", description: "", submissionType: "TEXT", dueDate: "", maxScore: "", allowResubmission: false });
  const [expandedAssignmentId, setExpandedAssignmentId] = useState<string | null>(null);
  const [gradeForms, setGradeForms] = useState<Record<string, { score: string; feedback: string }>>({});

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

            <Card>
              <CardHeader>
                <CardTitle>My courses — modules</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <NativeSelect
                  className="w-64"
                  placeholder="Select a course"
                  value={courseId}
                  onChange={(v) => {
                    setCourseId(v);
                    setExpandedModuleId(null);
                  }}
                  options={me.data.teachingAssignments.map((t) => ({ value: t.id, label: t.subject.name }))}
                />

                {courseId ? (
                  <>
                    {!modules.data || modules.data.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No modules yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {modules.data.map((m) => (
                          <li key={m.id} className="rounded-md border p-3 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <button
                                type="button"
                                className="text-left font-medium"
                                onClick={() => setExpandedModuleId(expandedModuleId === m.id ? null : m.id)}
                              >
                                {m.sequence}. {m.title}
                              </button>
                              <div className="flex items-center gap-2">
                                <Badge variant={m.isPublished ? "success" : "secondary"}>
                                  {m.isPublished ? "Published" : "Draft"}
                                </Badge>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={async () => {
                                    try {
                                      await api.updateCourseModule(m.id, { isPublished: !m.isPublished });
                                      modules.mutate();
                                    } catch (err) {
                                      toast.error(errorMessage(err, "Failed to update module"));
                                    }
                                  }}
                                >
                                  {m.isPublished ? "Unpublish" : "Publish"}
                                </Button>
                              </div>
                            </div>
                            {expandedModuleId === m.id ? (
                              <div className="mt-3 space-y-3 border-t pt-3">
                                {m.items.length === 0 ? (
                                  <p className="text-muted-foreground text-xs">No items yet.</p>
                                ) : (
                                  <ul className="space-y-1">
                                    {m.items.map((item) => (
                                      <li key={item.id} className="flex items-center justify-between gap-2 text-xs">
                                        <span>
                                          {item.sequence}. [{item.type}] {item.title}
                                        </span>
                                        <div className="flex items-center gap-2">
                                          <Badge variant={item.isPublished ? "success" : "secondary"}>
                                            {item.isPublished ? "Published" : "Draft"}
                                          </Badge>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-6"
                                            onClick={async () => {
                                              try {
                                                await api.updateCourseModuleItem(item.id, { isPublished: !item.isPublished });
                                                modules.mutate();
                                              } catch (err) {
                                                toast.error(errorMessage(err, "Failed to update item"));
                                              }
                                            }}
                                          >
                                            {item.isPublished ? "Unpublish" : "Publish"}
                                          </Button>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                <form
                                  className="flex flex-wrap items-end gap-2"
                                  onSubmit={async (e: FormEvent) => {
                                    e.preventDefault();
                                    try {
                                      await api.addCourseModuleItem(m.id, {
                                        title: itemForm.title,
                                        type: itemForm.type,
                                        content: itemForm.content,
                                        sequence: Number(itemForm.sequence),
                                      });
                                      setItemForm({ title: "", type: "PAGE", content: "", sequence: String(m.items.length + 2) });
                                      modules.mutate();
                                      toast.success("Item added");
                                    } catch (err) {
                                      toast.error(errorMessage(err, "Failed to add item"));
                                    }
                                  }}
                                >
                                  <div className="space-y-1">
                                    <Label className="text-xs">Title</Label>
                                    <Input
                                      className="h-7 w-32"
                                      value={itemForm.title}
                                      onChange={(e) => setItemForm((f) => ({ ...f, title: e.target.value }))}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Type</Label>
                                    <NativeSelect
                                      className="h-7 w-28"
                                      placeholder="Select type"
                                      value={itemForm.type}
                                      onChange={(v) => setItemForm((f) => ({ ...f, type: v as CourseModuleItemType }))}
                                      options={[
                                        { value: "PAGE", label: "Page (text)" },
                                        { value: "LINK", label: "Link" },
                                        { value: "VIDEO", label: "Video URL" },
                                        { value: "DOCUMENT", label: "Document URL" },
                                      ]}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">{itemForm.type === "PAGE" ? "Text" : "URL"}</Label>
                                    <Input
                                      className="h-7 w-48"
                                      value={itemForm.content}
                                      onChange={(e) => setItemForm((f) => ({ ...f, content: e.target.value }))}
                                    />
                                  </div>
                                  <Button type="submit" size="sm" className="h-7" disabled={!itemForm.title || !itemForm.content}>
                                    Add item
                                  </Button>
                                </form>
                              </div>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}

                    <Separator />

                    <form
                      className="flex flex-wrap items-end gap-3"
                      onSubmit={async (e: FormEvent) => {
                        e.preventDefault();
                        try {
                          await api.createCourseModule({
                            teachingAssignmentId: courseId,
                            title: moduleForm.title,
                            description: moduleForm.description || undefined,
                            sequence: Number(moduleForm.sequence),
                          });
                          setModuleForm({ title: "", description: "", sequence: String((modules.data?.length ?? 0) + 2) });
                          modules.mutate();
                          toast.success("Module created");
                        } catch (err) {
                          toast.error(errorMessage(err, "Failed to create module"));
                        }
                      }}
                    >
                      <div className="space-y-1">
                        <Label className="text-xs">Module title</Label>
                        <Input
                          className="w-40"
                          value={moduleForm.title}
                          onChange={(e) => setModuleForm((f) => ({ ...f, title: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Order</Label>
                        <Input
                          type="number"
                          className="w-20"
                          value={moduleForm.sequence}
                          onChange={(e) => setModuleForm((f) => ({ ...f, sequence: e.target.value }))}
                        />
                      </div>
                      <Button type="submit" size="sm" disabled={!moduleForm.title}>
                        Add module
                      </Button>
                    </form>
                  </>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>My courses — assignments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <NativeSelect
                  className="w-64"
                  placeholder="Select a course"
                  value={courseId}
                  onChange={(v) => {
                    setCourseId(v);
                    setExpandedAssignmentId(null);
                  }}
                  options={me.data.teachingAssignments.map((t) => ({ value: t.id, label: t.subject.name }))}
                />

                {courseId ? (
                  <>
                    {!assignments.data || assignments.data.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No assignments yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {assignments.data.map((a) => (
                          <li key={a.id} className="rounded-md border p-3 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <button
                                type="button"
                                className="text-left font-medium"
                                onClick={() => setExpandedAssignmentId(expandedAssignmentId === a.id ? null : a.id)}
                              >
                                {a.title}
                                {a.dueDate ? (
                                  <span className="text-muted-foreground font-normal">
                                    {" "}
                                    — due {new Date(a.dueDate).toLocaleDateString()}
                                  </span>
                                ) : null}
                              </button>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">{a.submissions.length} submitted</Badge>
                                <Badge variant={a.isPublished ? "success" : "secondary"}>
                                  {a.isPublished ? "Published" : "Draft"}
                                </Badge>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={async () => {
                                    try {
                                      await api.updateTeacherAssignment(a.id, { isPublished: !a.isPublished });
                                      assignments.mutate();
                                    } catch (err) {
                                      toast.error(errorMessage(err, "Failed to update assignment"));
                                    }
                                  }}
                                >
                                  {a.isPublished ? "Unpublish" : "Publish"}
                                </Button>
                              </div>
                            </div>
                            {expandedAssignmentId === a.id ? (
                              <div className="mt-3 space-y-2 border-t pt-3">
                                {a.submissions.length === 0 ? (
                                  <p className="text-muted-foreground text-xs">No submissions yet.</p>
                                ) : (
                                  a.submissions.map((s) => {
                                    const isLate = a.dueDate && new Date(s.submittedAt) > new Date(a.dueDate);
                                    const form = gradeForms[s.studentId] ?? { score: s.score?.toString() ?? "", feedback: s.feedback ?? "" };
                                    return (
                                      <div key={s.id} className="rounded border p-2 text-xs">
                                        <div className="flex items-center justify-between gap-2">
                                          <span>
                                            {s.student.firstName} {s.student.lastName}{" "}
                                            <span className="text-muted-foreground">
                                              — submitted {new Date(s.submittedAt).toLocaleString()}
                                            </span>
                                            {isLate ? <Badge variant="warning" className="ml-1">Late</Badge> : null}
                                            <Badge variant={statusVariant(s.status)} className="ml-1">
                                              {s.status}
                                            </Badge>
                                          </span>
                                        </div>
                                        {s.content ? <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{s.content}</p> : null}
                                        <form
                                          className="mt-2 flex flex-wrap items-end gap-2"
                                          onSubmit={async (e: FormEvent) => {
                                            e.preventDefault();
                                            try {
                                              await api.gradeTeacherSubmission(a.id, s.studentId, {
                                                score: Number(form.score),
                                                feedback: form.feedback || undefined,
                                              });
                                              assignments.mutate();
                                              toast.success("Graded");
                                            } catch (err) {
                                              toast.error(errorMessage(err, "Failed to grade"));
                                            }
                                          }}
                                        >
                                          <div className="space-y-1">
                                            <Label className="text-xs">Score</Label>
                                            <Input
                                              type="number"
                                              className="h-7 w-20"
                                              value={form.score}
                                              onChange={(e) =>
                                                setGradeForms((f) => ({ ...f, [s.studentId]: { ...form, score: e.target.value } }))
                                              }
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs">Feedback</Label>
                                            <Input
                                              className="h-7 w-48"
                                              value={form.feedback}
                                              onChange={(e) =>
                                                setGradeForms((f) => ({ ...f, [s.studentId]: { ...form, feedback: e.target.value } }))
                                              }
                                            />
                                          </div>
                                          <Button type="submit" size="sm" className="h-7" disabled={!form.score}>
                                            Save grade
                                          </Button>
                                        </form>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}

                    <Separator />

                    <form
                      className="flex flex-wrap items-end gap-3"
                      onSubmit={async (e: FormEvent) => {
                        e.preventDefault();
                        try {
                          await api.createTeacherAssignment({
                            teachingAssignmentId: courseId,
                            title: assignmentForm.title,
                            description: assignmentForm.description || undefined,
                            submissionType: assignmentForm.submissionType,
                            dueDate: assignmentForm.dueDate || undefined,
                            maxScore: assignmentForm.maxScore ? Number(assignmentForm.maxScore) : undefined,
                            allowResubmission: assignmentForm.allowResubmission,
                          });
                          setAssignmentForm({
                            title: "",
                            description: "",
                            submissionType: "TEXT",
                            dueDate: "",
                            maxScore: "",
                            allowResubmission: false,
                          });
                          assignments.mutate();
                          toast.success("Assignment created");
                        } catch (err) {
                          toast.error(errorMessage(err, "Failed to create assignment"));
                        }
                      }}
                    >
                      <div className="space-y-1">
                        <Label className="text-xs">Title</Label>
                        <Input
                          className="w-40"
                          value={assignmentForm.title}
                          onChange={(e) => setAssignmentForm((f) => ({ ...f, title: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Due date</Label>
                        <Input
                          type="date"
                          className="w-36"
                          value={assignmentForm.dueDate}
                          onChange={(e) => setAssignmentForm((f) => ({ ...f, dueDate: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Max score</Label>
                        <Input
                          type="number"
                          className="w-20"
                          value={assignmentForm.maxScore}
                          onChange={(e) => setAssignmentForm((f) => ({ ...f, maxScore: e.target.value }))}
                        />
                      </div>
                      <label className="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={assignmentForm.allowResubmission}
                          onChange={(e) => setAssignmentForm((f) => ({ ...f, allowResubmission: e.target.checked }))}
                        />
                        Allow resubmission
                      </label>
                      <Button type="submit" size="sm" disabled={!assignmentForm.title}>
                        Add assignment
                      </Button>
                    </form>
                  </>
                ) : null}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
