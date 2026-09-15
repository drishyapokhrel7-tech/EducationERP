"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { submitAction } from "@/lib/submit-action";

export default function GuardianQuestionsPage() {
  const children = useSWR("guardian-my-children", () => api.listMyChildren());
  const [studentId, setStudentId] = useState("");

  const list = children.data?.children ?? [];
  if (!studentId && list.length > 0) setStudentId(list[0].student.id);

  const teachingAssignments = useSWR(
    studentId ? ["guardian-tas", studentId] : null,
    () => api.listChildTeachingAssignments(studentId),
  );
  const questions = useSWR(
    studentId ? ["guardian-questions", studentId] : null,
    () => api.listMyGuardianQuestions(studentId),
  );

  const [form, setForm] = useState({ teachingAssignmentId: "", subject: "", body: "" });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Questions</h1>
        <p className="text-muted-foreground text-sm">
          Ask your child&apos;s teacher a question about a specific class.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ask a question</CardTitle>
        </CardHeader>
        <CardContent>
          {list.length > 0 ? (
            <div className="mb-4 space-y-2">
              <Label>Child</Label>
              <NativeSelect
                className="w-64"
                placeholder="Select a child"
                value={studentId}
                onChange={setStudentId}
                options={list.map((c) => ({
                  value: c.student.id,
                  label: `${c.student.firstName} ${c.student.lastName} (${c.relationship})`,
                }))}
              />
            </div>
          ) : null}
          <form
            className="space-y-4"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              submitAction(
                () => api.askGuardianQuestion(studentId, form),
                () => {
                  setForm({ teachingAssignmentId: "", subject: "", body: "" });
                  questions.mutate();
                },
                "Question sent",
              );
            }}
          >
            <div className="space-y-2">
              <Label>Class</Label>
              <NativeSelect
                className="w-full"
                placeholder="Select a class"
                value={form.teachingAssignmentId}
                onChange={(v) => setForm((f) => ({ ...f, teachingAssignmentId: v }))}
                options={(teachingAssignments.data ?? []).map((t) => ({
                  value: t.id,
                  label: `${t.subject.name} — ${t.employee.firstName} ${t.employee.lastName}`,
                }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                required
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body">Question</Label>
              <Textarea
                id="body"
                required
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              />
            </div>
            <Button type="submit" disabled={!studentId || !form.teachingAssignmentId || !form.subject || !form.body}>
              Send question
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Past questions</CardTitle>
        </CardHeader>
        <CardContent>
          {!questions.data || questions.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No questions asked yet.</p>
          ) : (
            <ul className="divide-y">
              {questions.data.map((q) => (
                <li key={q.id} className="space-y-1 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{q.subject}</p>
                    <Badge variant={q.answer ? "success" : "secondary"}>
                      {q.answer ? "Answered" : "Awaiting answer"}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {q.teachingAssignment.subject.name}
                    {q.teachingAssignment.employee
                      ? ` — ${q.teachingAssignment.employee.firstName} ${q.teachingAssignment.employee.lastName}`
                      : ""}
                  </p>
                  <p>{q.body}</p>
                  {q.answer ? <p className="text-muted-foreground">Answer: {q.answer}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
