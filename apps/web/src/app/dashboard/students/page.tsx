"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";

function EntityCard({
  title,
  emptyLabel,
  items,
  renderItem,
  children,
}: {
  title: string;
  emptyLabel: string;
  items: unknown[] | undefined;
  renderItem: (item: never) => ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!items || items.length === 0 ? (
          <p className="text-muted-foreground text-sm">{emptyLabel}</p>
        ) : (
          <ul className="divide-y">
            {items.map((item, i) => (
              <li key={i} className="py-2 text-sm">
                {renderItem(item as never)}
              </li>
            ))}
          </ul>
        )}
        <Separator />
        {children}
      </CardContent>
    </Card>
  );
}

export default function StudentsPage() {
  const students = useSWR("students", () => api.listStudents());
  const guardians = useSWR("guardians", () => api.listGuardians());
  const programs = useSWR("programs", () => api.listPrograms());
  const sections = useSWR("sections", () => api.listSections());
  const terms = useSWR("terms", () => api.listTerms());

  const [studentForm, setStudentForm] = useState({
    studentCode: "",
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
  });
  const [guardianForm, setGuardianForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
  });
  const [linkForm, setLinkForm] = useState({
    studentId: "",
    guardianId: "",
    relationship: "",
    isPrimaryContact: true,
  });
  const [enrollForm, setEnrollForm] = useState({
    studentId: "",
    programId: "",
    sectionId: "",
    termId: "",
    enrollmentDate: "",
  });

  async function submit(action: () => Promise<unknown>, onSuccess: () => void) {
    try {
      await action();
      onSuccess();
      toast.success("Saved");
    } catch {
      toast.error("Failed — check that required fields are filled in");
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Students</h1>
        <p className="text-muted-foreground text-sm">
          Guardians are a shared catalog (siblings can share one). Enrollment links a student to
          a program, section and term.
        </p>
      </div>

      <EntityCard
        title="Students"
        emptyLabel="No students yet."
        items={students.data}
        renderItem={(s: {
          firstName: string;
          lastName: string;
          studentCode: string;
          status: string;
          guardians: { relationship: string; guardian: { firstName: string; lastName: string } }[];
        }) => (
          <div>
            <span>
              {s.firstName} {s.lastName}{" "}
              <span className="text-muted-foreground">
                {s.studentCode} · {s.status}
              </span>
            </span>
            {s.guardians.length > 0 ? (
              <p className="text-muted-foreground mt-1 text-xs">
                {s.guardians
                  .map((g) => `${g.guardian.firstName} ${g.guardian.lastName} (${g.relationship})`)
                  .join(", ")}
              </p>
            ) : null}
          </div>
        )}
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            submit(
              () => api.createStudent({ ...studentForm, gender: studentForm.gender || undefined }),
              () => {
                setStudentForm({ studentCode: "", firstName: "", lastName: "", dateOfBirth: "", gender: "" });
                students.mutate();
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label>Student code</Label>
            <Input
              required
              className="w-28"
              value={studentForm.studentCode}
              onChange={(e) => setStudentForm((f) => ({ ...f, studentCode: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>First name</Label>
            <Input
              required
              value={studentForm.firstName}
              onChange={(e) => setStudentForm((f) => ({ ...f, firstName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Last name</Label>
            <Input
              required
              value={studentForm.lastName}
              onChange={(e) => setStudentForm((f) => ({ ...f, lastName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Date of birth</Label>
            <Input
              required
              type="date"
              value={studentForm.dateOfBirth}
              onChange={(e) => setStudentForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Gender (optional)</Label>
            <Input
              className="w-28"
              value={studentForm.gender}
              onChange={(e) => setStudentForm((f) => ({ ...f, gender: e.target.value }))}
            />
          </div>
          <Button type="submit">Add</Button>
        </form>
      </EntityCard>

      <EntityCard
        title="Guardians"
        emptyLabel="No guardians yet."
        items={guardians.data}
        renderItem={(g: { firstName: string; lastName: string; phone: string }) => (
          <span>
            {g.firstName} {g.lastName} <span className="text-muted-foreground">{g.phone}</span>
          </span>
        )}
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            submit(
              () => api.createGuardian({ ...guardianForm, email: guardianForm.email || undefined }),
              () => {
                setGuardianForm({ firstName: "", lastName: "", phone: "", email: "" });
                guardians.mutate();
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label>First name</Label>
            <Input
              required
              value={guardianForm.firstName}
              onChange={(e) => setGuardianForm((f) => ({ ...f, firstName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Last name</Label>
            <Input
              required
              value={guardianForm.lastName}
              onChange={(e) => setGuardianForm((f) => ({ ...f, lastName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input
              required
              value={guardianForm.phone}
              onChange={(e) => setGuardianForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Email (optional)</Label>
            <Input
              type="email"
              value={guardianForm.email}
              onChange={(e) => setGuardianForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <Button type="submit">Add</Button>
        </form>

        <Separator />

        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            submit(
              () =>
                api.attachGuardian(linkForm.studentId, {
                  guardianId: linkForm.guardianId,
                  relationship: linkForm.relationship,
                  isPrimaryContact: linkForm.isPrimaryContact,
                }),
              () => {
                setLinkForm((f) => ({ ...f, relationship: "" }));
                students.mutate();
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label>Link guardian to student</Label>
            <NativeSelect
              className="w-40"
              placeholder="Select student"
              value={linkForm.studentId}
              onChange={(v) => setLinkForm((f) => ({ ...f, studentId: v }))}
              options={(students.data ?? []).map((s) => ({
                value: s.id,
                label: `${s.firstName} ${s.lastName}`,
              }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Guardian</Label>
            <NativeSelect
              className="w-40"
              placeholder="Select guardian"
              value={linkForm.guardianId}
              onChange={(v) => setLinkForm((f) => ({ ...f, guardianId: v }))}
              options={(guardians.data ?? []).map((g) => ({
                value: g.id,
                label: `${g.firstName} ${g.lastName}`,
              }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Relationship</Label>
            <Input
              required
              className="w-28"
              placeholder="Father"
              value={linkForm.relationship}
              onChange={(e) => setLinkForm((f) => ({ ...f, relationship: e.target.value }))}
            />
          </div>
          <Button type="submit" disabled={!linkForm.studentId || !linkForm.guardianId}>
            Link
          </Button>
        </form>
      </EntityCard>

      <EntityCard
        title="Enrollment"
        emptyLabel="Enroll a student in a program, section and term."
        items={undefined}
        renderItem={() => null}
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            submit(
              () =>
                api.createEnrollment(enrollForm.studentId, {
                  programId: enrollForm.programId,
                  sectionId: enrollForm.sectionId,
                  termId: enrollForm.termId,
                  enrollmentDate: enrollForm.enrollmentDate,
                }),
              () => {
                setEnrollForm((f) => ({ ...f, programId: "", sectionId: "", termId: "", enrollmentDate: "" }));
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label>Student</Label>
            <NativeSelect
              className="w-40"
              placeholder="Select student"
              value={enrollForm.studentId}
              onChange={(v) => setEnrollForm((f) => ({ ...f, studentId: v }))}
              options={(students.data ?? []).map((s) => ({
                value: s.id,
                label: `${s.firstName} ${s.lastName}`,
              }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Program</Label>
            <NativeSelect
              className="w-40"
              placeholder="Select program"
              value={enrollForm.programId}
              onChange={(v) => setEnrollForm((f) => ({ ...f, programId: v }))}
              options={(programs.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Section</Label>
            <NativeSelect
              className="w-40"
              placeholder="Select section"
              value={enrollForm.sectionId}
              onChange={(v) => setEnrollForm((f) => ({ ...f, sectionId: v }))}
              options={(sections.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Term</Label>
            <NativeSelect
              className="w-40"
              placeholder="Select term"
              value={enrollForm.termId}
              onChange={(v) => setEnrollForm((f) => ({ ...f, termId: v }))}
              options={(terms.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Enrollment date</Label>
            <Input
              required
              type="date"
              value={enrollForm.enrollmentDate}
              onChange={(e) => setEnrollForm((f) => ({ ...f, enrollmentDate: e.target.value }))}
            />
          </div>
          <Button
            type="submit"
            disabled={
              !enrollForm.studentId || !enrollForm.programId || !enrollForm.sectionId || !enrollForm.termId
            }
          >
            Enroll
          </Button>
        </form>
      </EntityCard>
    </div>
  );
}
