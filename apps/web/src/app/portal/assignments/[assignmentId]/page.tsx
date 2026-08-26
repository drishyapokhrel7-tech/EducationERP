"use client";

import { use, useState, type FormEvent } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { statusVariant } from "@/lib/status-variant";

function errorMessage(err: unknown, fallback: string) {
  const message =
    err && typeof err === "object" && "body" in err
      ? ((err as { body?: { message?: string } }).body?.message ?? null)
      : null;
  return typeof message === "string" ? message : fallback;
}

export default function PortalAssignmentDetailPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = use(params);
  const assignment = useSWR(["portal-assignment", assignmentId], () => api.getStudentAssignment(assignmentId));
  const [content, setContent] = useState("");

  const isLate =
    assignment.data?.dueDate && assignment.data.mySubmission
      ? new Date(assignment.data.mySubmission.submittedAt) > new Date(assignment.data.dueDate)
      : false;
  const isPastDue = assignment.data?.dueDate ? new Date() > new Date(assignment.data.dueDate) : false;
  const canResubmit = assignment.data?.mySubmission ? assignment.data.allowResubmission : true;

  return (
    <div className="max-w-2xl space-y-6">
      {!assignment.data ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <>
          <div>
            <h1 className="text-2xl font-semibold">{assignment.data.title}</h1>
            <p className="text-muted-foreground text-sm">
              {assignment.data.teachingAssignment.subject.name} ·{" "}
              {assignment.data.teachingAssignment.employee.firstName} {assignment.data.teachingAssignment.employee.lastName}
              {assignment.data.dueDate ? ` · due ${new Date(assignment.data.dueDate).toLocaleString()}` : ""}
              {assignment.data.maxScore ? ` · ${assignment.data.maxScore} points` : ""}
            </p>
          </div>

          {assignment.data.description ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Instructions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{assignment.data.description}</p>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                Your submission
                {assignment.data.mySubmission ? (
                  <>
                    <Badge variant={statusVariant(assignment.data.mySubmission.status)}>
                      {assignment.data.mySubmission.status}
                    </Badge>
                    {isLate ? <Badge variant="warning">Late</Badge> : null}
                  </>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {assignment.data.mySubmission ? (
                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    Submitted {new Date(assignment.data.mySubmission.submittedAt).toLocaleString()}
                  </p>
                  {assignment.data.mySubmission.content ? (
                    <p className="whitespace-pre-wrap rounded-md border p-3">{assignment.data.mySubmission.content}</p>
                  ) : null}
                  {assignment.data.mySubmission.status === "GRADED" ? (
                    <div className="rounded-md border p-3">
                      <p className="font-medium">
                        Grade: {assignment.data.mySubmission.score}
                        {assignment.data.maxScore ? ` / ${assignment.data.maxScore}` : ""}
                      </p>
                      {assignment.data.mySubmission.feedback ? (
                        <p className="text-muted-foreground mt-1 whitespace-pre-wrap">
                          {assignment.data.mySubmission.feedback}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Not submitted yet.</p>
              )}

              {canResubmit ? (
                <form
                  className="space-y-2"
                  onSubmit={async (e: FormEvent) => {
                    e.preventDefault();
                    try {
                      await api.submitStudentAssignment(assignmentId, { content: content || undefined });
                      setContent("");
                      assignment.mutate();
                      toast.success("Submitted");
                    } catch (err) {
                      toast.error(errorMessage(err, "Failed to submit"));
                    }
                  }}
                >
                  <textarea
                    className="border-input focus-visible:border-ring focus-visible:ring-ring/50 min-h-24 w-full rounded-lg border bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors focus-visible:ring-3"
                    placeholder="Write your answer or paste a link…"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                  <Button type="submit" disabled={!content}>
                    {assignment.data.mySubmission ? "Resubmit" : "Submit"}
                  </Button>
                  {isPastDue ? (
                    <p className="text-muted-foreground text-xs">
                      This is past the due date — your submission will be marked late.
                    </p>
                  ) : null}
                </form>
              ) : (
                <p className="text-muted-foreground text-sm">
                  This assignment doesn&apos;t allow resubmission, and you&apos;ve already submitted.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
