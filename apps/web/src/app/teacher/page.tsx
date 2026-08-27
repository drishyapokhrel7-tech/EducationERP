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
import { NotificationBell } from "@/components/notification-bell";
import { FileUploadButton } from "@/components/file-upload-button";
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
  const [itemForm, setItemForm] = useState<{ title: string; type: CourseModuleItemType; content: string }>({
    title: "",
    type: "PAGE",
    content: "",
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

  const quizzes = useSWR(courseId ? ["teacher-quizzes", courseId] : null, () => api.listTeacherQuizzes(courseId));
  const [quizForm, setQuizForm] = useState({ title: "", durationMinutes: "" });
  const [expandedQuizId, setExpandedQuizId] = useState<string | null>(null);
  const [questionForm, setQuestionForm] = useState({
    text: "",
    options: ["", "", "", ""],
    correctOptionIndex: "0",
    sequence: "1",
  });

  const announcements = useSWR(
    courseId ? ["teacher-announcements", courseId] : null,
    () => api.listTeacherAnnouncements(courseId),
  );
  const [announcementForm, setAnnouncementForm] = useState({ title: "", body: "" });

  const discussionTopics = useSWR(
    courseId ? ["teacher-discussion-topics", courseId] : null,
    () => api.listTeacherDiscussionTopics(courseId),
  );
  const [topicForm, setTopicForm] = useState({ title: "", body: "" });
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null);
  const expandedTopic = useSWR(
    expandedTopicId ? ["teacher-discussion-topic", expandedTopicId] : null,
    () => api.getTeacherDiscussionTopic(expandedTopicId as string),
  );
  const [replyBody, setReplyBody] = useState("");

  // Gradebook (LMS discovery slice 7) — the grid is built from the
  // roster plus the same `assignments`/`quizzes` data already fetched
  // above for those cards; no separate fetch of grade data.
  const roster = useSWR(courseId ? ["teacher-roster", courseId] : null, () => api.getTeacherCourseRoster(courseId));

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
        <div className="flex items-center gap-2">
          <NotificationBell />
          <Button variant="ghost" size="icon" onClick={() => logout().then(() => router.push("/login"))}>
            <LogOut className="size-4" />
          </Button>
        </div>
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
                          <FileUploadButton onUploaded={(url) => setMaterialForm((f) => ({ ...f, url }))} />
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
                                      // Derived from this module's actual current items every
                                      // time, not tracked in form state — a stale/hardcoded
                                      // default here would collide with whichever sequence
                                      // number already exists (e.g. seed data starting at 1),
                                      // with no field in this form for the user to override it.
                                      const nextSequence = Math.max(0, ...m.items.map((i) => i.sequence)) + 1;
                                      await api.addCourseModuleItem(m.id, {
                                        title: itemForm.title,
                                        type: itemForm.type,
                                        content: itemForm.content,
                                        sequence: nextSequence,
                                      });
                                      setItemForm({ title: "", type: "PAGE", content: "" });
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
                                  {itemForm.type !== "PAGE" ? (
                                    <FileUploadButton onUploaded={(url) => setItemForm((f) => ({ ...f, content: url }))} />
                                  ) : null}
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
                      <div className="space-y-1">
                        <Label className="text-xs">Submission type</Label>
                        <NativeSelect
                          className="h-9 w-28"
                          placeholder="Select type"
                          value={assignmentForm.submissionType}
                          onChange={(v) => setAssignmentForm((f) => ({ ...f, submissionType: v as SubmissionType }))}
                          options={[
                            { value: "TEXT", label: "Text" },
                            { value: "FILE", label: "File" },
                          ]}
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

            <Card>
              <CardHeader>
                <CardTitle>My courses — quizzes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <NativeSelect
                  className="w-64"
                  placeholder="Select a course"
                  value={courseId}
                  onChange={(v) => {
                    setCourseId(v);
                    setExpandedQuizId(null);
                  }}
                  options={me.data.teachingAssignments.map((t) => ({ value: t.id, label: t.subject.name }))}
                />

                {courseId ? (
                  <>
                    {!quizzes.data || quizzes.data.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No quizzes yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {quizzes.data.map((qz) => (
                          <li key={qz.id} className="rounded-md border p-3 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <button
                                type="button"
                                className="text-left font-medium"
                                onClick={() => setExpandedQuizId(expandedQuizId === qz.id ? null : qz.id)}
                              >
                                {qz.title}
                                <span className="text-muted-foreground font-normal">
                                  {" "}
                                  — {qz.questions.length} question{qz.questions.length === 1 ? "" : "s"}
                                  {qz.durationMinutes ? `, ${qz.durationMinutes} min` : ""}
                                </span>
                              </button>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">{qz.attempts.length} attempted</Badge>
                                <Badge variant={qz.status === "PUBLISHED" ? "success" : "secondary"}>
                                  {qz.status === "PUBLISHED" ? "Published" : "Draft"}
                                </Badge>
                                {qz.status !== "PUBLISHED" ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={qz.questions.length === 0}
                                    onClick={async () => {
                                      try {
                                        await api.publishTeacherQuiz(qz.id);
                                        quizzes.mutate();
                                        toast.success("Quiz published");
                                      } catch (err) {
                                        toast.error(errorMessage(err, "Failed to publish quiz"));
                                      }
                                    }}
                                  >
                                    Publish
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                            {expandedQuizId === qz.id ? (
                              <div className="mt-3 space-y-3 border-t pt-3">
                                {qz.questions.length === 0 ? (
                                  <p className="text-muted-foreground text-xs">No questions yet.</p>
                                ) : (
                                  <ul className="list-decimal space-y-1 pl-4 text-xs">
                                    {qz.questions.map((question) => (
                                      <li key={question.id}>
                                        {question.text}{" "}
                                        <span className="text-muted-foreground">
                                          (correct: {question.options[question.correctOptionIndex]})
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                )}

                                {qz.attempts.length > 0 ? (
                                  <div className="space-y-1">
                                    <p className="text-xs font-medium">Attempts</p>
                                    <ul className="space-y-1 text-xs">
                                      {qz.attempts.map((a) => (
                                        <li key={a.id} className="flex items-center justify-between">
                                          <span>
                                            {a.student.firstName} {a.student.lastName}
                                          </span>
                                          <span className="text-muted-foreground">
                                            {a.submittedAt ? `${a.score?.toFixed(0)}%` : "In progress"}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : null}

                                {qz.status !== "PUBLISHED" ? (
                                  <form
                                    className="space-y-2"
                                    onSubmit={async (e: FormEvent) => {
                                      e.preventDefault();
                                      const filledOptions = questionForm.options.map((o) => o.trim()).filter(Boolean);
                                      try {
                                        await api.addTeacherQuizQuestion(qz.id, {
                                          text: questionForm.text,
                                          options: filledOptions,
                                          correctOptionIndex: Number(questionForm.correctOptionIndex),
                                          sequence: Number(questionForm.sequence),
                                        });
                                        setQuestionForm({
                                          text: "",
                                          options: ["", "", "", ""],
                                          correctOptionIndex: "0",
                                          sequence: String(qz.questions.length + 2),
                                        });
                                        quizzes.mutate();
                                        toast.success("Question added");
                                      } catch (err) {
                                        toast.error(errorMessage(err, "Failed to add question"));
                                      }
                                    }}
                                  >
                                    <div className="space-y-1">
                                      <Label className="text-xs">Question text</Label>
                                      <Input
                                        className="h-7 w-full"
                                        value={questionForm.text}
                                        onChange={(e) => setQuestionForm((f) => ({ ...f, text: e.target.value }))}
                                      />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      {questionForm.options.map((opt, i) => (
                                        <Input
                                          key={i}
                                          className="h-7"
                                          placeholder={`Option ${i + 1}`}
                                          value={opt}
                                          onChange={(e) =>
                                            setQuestionForm((f) => ({
                                              ...f,
                                              options: f.options.map((o, oi) => (oi === i ? e.target.value : o)),
                                            }))
                                          }
                                        />
                                      ))}
                                    </div>
                                    <div className="flex flex-wrap items-end gap-2">
                                      <div className="space-y-1">
                                        <Label className="text-xs">Correct answer</Label>
                                        <NativeSelect
                                          className="h-7 w-40"
                                          placeholder="Select correct option"
                                          value={questionForm.correctOptionIndex}
                                          onChange={(v) => setQuestionForm((f) => ({ ...f, correctOptionIndex: v }))}
                                          options={questionForm.options
                                            .map((o, i) => ({ value: String(i), label: o.trim() }))
                                            .filter((o) => o.label)}
                                        />
                                      </div>
                                      <Button
                                        type="submit"
                                        size="sm"
                                        className="h-7"
                                        disabled={
                                          !questionForm.text ||
                                          questionForm.options.map((o) => o.trim()).filter(Boolean).length < 2
                                        }
                                      >
                                        Add question
                                      </Button>
                                    </div>
                                  </form>
                                ) : null}
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
                          await api.createTeacherQuiz({
                            teachingAssignmentId: courseId,
                            title: quizForm.title,
                            durationMinutes: quizForm.durationMinutes ? Number(quizForm.durationMinutes) : undefined,
                          });
                          setQuizForm({ title: "", durationMinutes: "" });
                          quizzes.mutate();
                          toast.success("Quiz created");
                        } catch (err) {
                          toast.error(errorMessage(err, "Failed to create quiz"));
                        }
                      }}
                    >
                      <div className="space-y-1">
                        <Label className="text-xs">Quiz title</Label>
                        <Input
                          className="w-40"
                          value={quizForm.title}
                          onChange={(e) => setQuizForm((f) => ({ ...f, title: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Time limit (min)</Label>
                        <Input
                          type="number"
                          className="w-28"
                          placeholder="No limit"
                          value={quizForm.durationMinutes}
                          onChange={(e) => setQuizForm((f) => ({ ...f, durationMinutes: e.target.value }))}
                        />
                      </div>
                      <Button type="submit" size="sm" disabled={!quizForm.title}>
                        Add quiz
                      </Button>
                    </form>
                  </>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>My courses — announcements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <NativeSelect
                  className="w-64"
                  placeholder="Select a course"
                  value={courseId}
                  onChange={(v) => setCourseId(v)}
                  options={me.data.teachingAssignments.map((t) => ({ value: t.id, label: t.subject.name }))}
                />

                {courseId ? (
                  <>
                    {!announcements.data || announcements.data.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No announcements yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {announcements.data.map((a) => (
                          <li key={a.id} className="rounded-md border p-3 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-medium">{a.title}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant={a.isPublished ? "success" : "secondary"}>
                                  {a.isPublished ? "Published" : "Draft"}
                                </Badge>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={async () => {
                                    try {
                                      await api.updateTeacherAnnouncement(a.id, { isPublished: !a.isPublished });
                                      announcements.mutate();
                                    } catch (err) {
                                      toast.error(errorMessage(err, "Failed to update announcement"));
                                    }
                                  }}
                                >
                                  {a.isPublished ? "Unpublish" : "Publish"}
                                </Button>
                              </div>
                            </div>
                            <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{a.body}</p>
                          </li>
                        ))}
                      </ul>
                    )}

                    <Separator />

                    <form
                      className="space-y-2"
                      onSubmit={async (e: FormEvent) => {
                        e.preventDefault();
                        try {
                          await api.createTeacherAnnouncement({
                            teachingAssignmentId: courseId,
                            title: announcementForm.title,
                            body: announcementForm.body,
                          });
                          setAnnouncementForm({ title: "", body: "" });
                          announcements.mutate();
                          toast.success("Announcement created");
                        } catch (err) {
                          toast.error(errorMessage(err, "Failed to create announcement"));
                        }
                      }}
                    >
                      <div className="space-y-1">
                        <Label className="text-xs">Title</Label>
                        <Input
                          className="w-full"
                          value={announcementForm.title}
                          onChange={(e) => setAnnouncementForm((f) => ({ ...f, title: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Body</Label>
                        <textarea
                          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 min-h-20 w-full rounded-lg border bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors focus-visible:ring-3"
                          value={announcementForm.body}
                          onChange={(e) => setAnnouncementForm((f) => ({ ...f, body: e.target.value }))}
                        />
                      </div>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={!announcementForm.title || !announcementForm.body}
                      >
                        Post announcement
                      </Button>
                    </form>
                  </>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>My courses — discussions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <NativeSelect
                  className="w-64"
                  placeholder="Select a course"
                  value={courseId}
                  onChange={(v) => {
                    setCourseId(v);
                    setExpandedTopicId(null);
                  }}
                  options={me.data.teachingAssignments.map((t) => ({ value: t.id, label: t.subject.name }))}
                />

                {courseId ? (
                  <>
                    {!discussionTopics.data || discussionTopics.data.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No discussion topics yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {discussionTopics.data.map((t) => (
                          <li key={t.id} className="rounded-md border p-3 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <button
                                type="button"
                                className="text-left font-medium"
                                onClick={() => {
                                  setExpandedTopicId(expandedTopicId === t.id ? null : t.id);
                                  setReplyBody("");
                                }}
                              >
                                {t.title}
                              </button>
                              <div className="flex items-center gap-2">
                                <Badge variant={t.isPublished ? "success" : "secondary"}>
                                  {t.isPublished ? "Published" : "Draft"}
                                </Badge>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={async () => {
                                    try {
                                      await api.updateTeacherDiscussionTopic(t.id, { isPublished: !t.isPublished });
                                      discussionTopics.mutate();
                                    } catch (err) {
                                      toast.error(errorMessage(err, "Failed to update topic"));
                                    }
                                  }}
                                >
                                  {t.isPublished ? "Unpublish" : "Publish"}
                                </Button>
                              </div>
                            </div>
                            {expandedTopicId === t.id ? (
                              <div className="mt-3 space-y-3 border-t pt-3">
                                {!expandedTopic.data ? (
                                  <p className="text-muted-foreground text-xs">Loading…</p>
                                ) : (
                                  <>
                                    <p className="whitespace-pre-wrap">{expandedTopic.data.body}</p>
                                    {expandedTopic.data.posts.length === 0 ? (
                                      <p className="text-muted-foreground text-xs">No replies yet.</p>
                                    ) : (
                                      <ul className="space-y-2 border-t pt-2">
                                        {expandedTopic.data.posts.map((p) => (
                                          <li key={p.id} className="text-xs">
                                            <span className="font-medium">
                                              {p.authorEmployee
                                                ? `${p.authorEmployee.firstName} ${p.authorEmployee.lastName} (Teacher)`
                                                : p.authorStudent
                                                  ? `${p.authorStudent.firstName} ${p.authorStudent.lastName}`
                                                  : "Unknown"}
                                            </span>
                                            <p className="text-muted-foreground whitespace-pre-wrap">{p.body}</p>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                    <form
                                      className="flex flex-wrap items-end gap-2"
                                      onSubmit={async (e: FormEvent) => {
                                        e.preventDefault();
                                        try {
                                          await api.createTeacherDiscussionPost(t.id, { body: replyBody });
                                          setReplyBody("");
                                          expandedTopic.mutate();
                                        } catch (err) {
                                          toast.error(errorMessage(err, "Failed to reply"));
                                        }
                                      }}
                                    >
                                      <textarea
                                        className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-16 w-64 rounded-lg border bg-transparent px-2.5 py-1.5 text-xs outline-none transition-colors focus-visible:ring-3"
                                        placeholder="Write a reply…"
                                        value={replyBody}
                                        onChange={(e) => setReplyBody(e.target.value)}
                                      />
                                      <Button type="submit" size="sm" className="h-7" disabled={!replyBody}>
                                        Reply
                                      </Button>
                                    </form>
                                  </>
                                )}
                              </div>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}

                    <Separator />

                    <form
                      className="space-y-2"
                      onSubmit={async (e: FormEvent) => {
                        e.preventDefault();
                        try {
                          await api.createTeacherDiscussionTopic({
                            teachingAssignmentId: courseId,
                            title: topicForm.title,
                            body: topicForm.body,
                          });
                          setTopicForm({ title: "", body: "" });
                          discussionTopics.mutate();
                          toast.success("Topic created");
                        } catch (err) {
                          toast.error(errorMessage(err, "Failed to create topic"));
                        }
                      }}
                    >
                      <div className="space-y-1">
                        <Label className="text-xs">Title</Label>
                        <Input
                          className="w-full"
                          value={topicForm.title}
                          onChange={(e) => setTopicForm((f) => ({ ...f, title: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Body</Label>
                        <textarea
                          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 min-h-20 w-full rounded-lg border bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors focus-visible:ring-3"
                          value={topicForm.body}
                          onChange={(e) => setTopicForm((f) => ({ ...f, body: e.target.value }))}
                        />
                      </div>
                      <Button type="submit" size="sm" disabled={!topicForm.title || !topicForm.body}>
                        Start topic
                      </Button>
                    </form>
                  </>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Gradebook</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <NativeSelect
                  className="w-64"
                  placeholder="Select a course"
                  value={courseId}
                  onChange={(v) => setCourseId(v)}
                  options={me.data.teachingAssignments.map((t) => ({ value: t.id, label: t.subject.name }))}
                />

                {courseId ? (
                  !roster.data || !assignments.data || !quizzes.data ? (
                    <p className="text-muted-foreground text-sm">Loading…</p>
                  ) : roster.data.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No students enrolled in this course yet.</p>
                  ) : (
                    (() => {
                      const publishedAssignments = assignments.data!.filter((a) => a.isPublished);
                      const publishedQuizzes = quizzes.data!.filter((q) => q.status === "PUBLISHED");
                      if (publishedAssignments.length === 0 && publishedQuizzes.length === 0) {
                        return <p className="text-muted-foreground text-sm">No published assignments or quizzes yet.</p>;
                      }
                      return (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b text-left">
                                <th className="p-2 font-medium">Student</th>
                                {publishedAssignments.map((a) => (
                                  <th key={a.id} className="p-2 font-medium whitespace-nowrap">
                                    {a.title}
                                  </th>
                                ))}
                                {publishedQuizzes.map((q) => (
                                  <th key={q.id} className="p-2 font-medium whitespace-nowrap">
                                    {q.title}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {roster.data!.map((student) => (
                                <tr key={student.id} className="border-b last:border-0">
                                  <td className="p-2 whitespace-nowrap">
                                    {student.firstName} {student.lastName}
                                  </td>
                                  {publishedAssignments.map((a) => {
                                    const submission = a.submissions.find((s) => s.studentId === student.id);
                                    return (
                                      <td key={a.id} className="text-muted-foreground p-2">
                                        {submission
                                          ? submission.status === "GRADED"
                                            ? `${submission.score}${a.maxScore ? ` / ${a.maxScore}` : ""}`
                                            : "Submitted"
                                          : "—"}
                                      </td>
                                    );
                                  })}
                                  {publishedQuizzes.map((q) => {
                                    const attempt = q.attempts.find((att) => att.studentId === student.id);
                                    return (
                                      <td key={q.id} className="text-muted-foreground p-2">
                                        {attempt ? (attempt.submittedAt ? `${attempt.score?.toFixed(0)}%` : "In progress") : "—"}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()
                  )
                ) : null}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
