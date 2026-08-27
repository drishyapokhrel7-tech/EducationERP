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
    toast.error(errorMessage(err, "Failed"));
  }
}

export default function AlumniPage() {
  const students = useSWR("students", () => api.listStudents());
  const profiles = useSWR("alumni-profiles", () => api.listAlumniProfiles());
  const companies = useSWR("alumni-companies", () => api.listAlumniCompanies());

  const [profileForm, setProfileForm] = useState({ studentId: "", graduationYear: new Date().getFullYear().toString() });
  const [companyForm, setCompanyForm] = useState({ name: "", industry: "" });
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [educationForm, setEducationForm] = useState({ institutionName: "", degree: "" });
  const [careerForm, setCareerForm] = useState({ companyId: "", jobTitle: "", startDate: "" });
  const [skillForm, setSkillForm] = useState("");

  const graduatedStudents = (students.data ?? []).filter((s) => s.status === "GRADUATED");
  const selectedProfile = profiles.data?.find((p) => p.id === selectedProfileId);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Alumni &amp; Career</h1>
        <p className="text-muted-foreground text-sm">
          Alumni profiles for graduated students — post-graduation education, career history, skills, and certifications.
          Alumni manage their own profile through the same portal login they had as a student.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alumni profiles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!profiles.data || profiles.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No alumni profiles yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {profiles.data.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    <span className="font-medium">
                      {p.student.firstName} {p.student.lastName}
                    </span>{" "}
                    <span className="text-muted-foreground">— Class of {p.graduationYear}</span>
                    {p.currentOccupation ? <span className="text-muted-foreground"> · {p.currentOccupation}</span> : null}
                  </span>
                  <Button type="button" size="sm" variant="outline" onClick={() => setSelectedProfileId(p.id)}>
                    Manage
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Separator />
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              submitAction(
                () => api.createAlumniProfile({ studentId: profileForm.studentId, graduationYear: Number(profileForm.graduationYear) }),
                () => {
                  setProfileForm({ studentId: "", graduationYear: new Date().getFullYear().toString() });
                  profiles.mutate();
                },
              );
            }}
          >
            <div className="space-y-1">
              <Label className="text-xs">Graduated student</Label>
              <NativeSelect
                className="w-48"
                placeholder="Select student"
                value={profileForm.studentId}
                onChange={(v) => setProfileForm((f) => ({ ...f, studentId: v }))}
                options={graduatedStudents.map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}` }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Graduation year</Label>
              <Input
                className="w-28"
                type="number"
                value={profileForm.graduationYear}
                onChange={(e) => setProfileForm((f) => ({ ...f, graduationYear: e.target.value }))}
              />
            </div>
            <Button type="submit" size="sm" disabled={!profileForm.studentId || !profileForm.graduationYear}>
              Create profile
            </Button>
          </form>
          {graduatedStudents.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              No students are marked GRADUATED yet — set a student&apos;s status on the Students page first.
            </p>
          ) : null}

          {selectedProfile ? (
            <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-medium">
                {selectedProfile.student.firstName} {selectedProfile.student.lastName} — Class of {selectedProfile.graduationYear}
              </p>

              <div className="space-y-2">
                <p className="text-xs font-medium">Education</p>
                {selectedProfile.education.length === 0 ? (
                  <p className="text-muted-foreground text-xs">No education records yet.</p>
                ) : (
                  <ul className="text-xs">
                    {selectedProfile.education.map((e) => (
                      <li key={e.id}>
                        {e.degree} — {e.institutionName}
                        {e.startYear ? ` (${e.startYear}${e.endYear ? `–${e.endYear}` : ""})` : ""}
                      </li>
                    ))}
                  </ul>
                )}
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(e: FormEvent) => {
                    e.preventDefault();
                    submitAction(
                      () => api.addAlumniEducation(selectedProfile.id, educationForm),
                      () => {
                        setEducationForm({ institutionName: "", degree: "" });
                        profiles.mutate();
                      },
                    );
                  }}
                >
                  <Input
                    className="h-7 w-36"
                    placeholder="Institution"
                    value={educationForm.institutionName}
                    onChange={(e) => setEducationForm((f) => ({ ...f, institutionName: e.target.value }))}
                  />
                  <Input
                    className="h-7 w-32"
                    placeholder="Degree"
                    value={educationForm.degree}
                    onChange={(e) => setEducationForm((f) => ({ ...f, degree: e.target.value }))}
                  />
                  <Button type="submit" size="sm" className="h-7" disabled={!educationForm.institutionName || !educationForm.degree}>
                    Add
                  </Button>
                </form>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium">Career history</p>
                {selectedProfile.careerHistory.length === 0 ? (
                  <p className="text-muted-foreground text-xs">No career history yet.</p>
                ) : (
                  <ul className="text-xs">
                    {selectedProfile.careerHistory.map((c) => (
                      <li key={c.id}>
                        {c.jobTitle} at {c.company.name} — {new Date(c.startDate).toLocaleDateString()}
                        {c.endDate ? ` to ${new Date(c.endDate).toLocaleDateString()}` : " (current)"}
                      </li>
                    ))}
                  </ul>
                )}
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(e: FormEvent) => {
                    e.preventDefault();
                    submitAction(
                      () => api.addAlumniCareerHistory(selectedProfile.id, careerForm),
                      () => {
                        setCareerForm({ companyId: "", jobTitle: "", startDate: "" });
                        profiles.mutate();
                      },
                    );
                  }}
                >
                  <NativeSelect
                    className="h-7 w-36"
                    placeholder="Company"
                    value={careerForm.companyId}
                    onChange={(v) => setCareerForm((f) => ({ ...f, companyId: v }))}
                    options={(companies.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
                  />
                  <Input
                    className="h-7 w-32"
                    placeholder="Job title"
                    value={careerForm.jobTitle}
                    onChange={(e) => setCareerForm((f) => ({ ...f, jobTitle: e.target.value }))}
                  />
                  <Input
                    className="h-7 w-32"
                    type="date"
                    value={careerForm.startDate}
                    onChange={(e) => setCareerForm((f) => ({ ...f, startDate: e.target.value }))}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    className="h-7"
                    disabled={!careerForm.companyId || !careerForm.jobTitle || !careerForm.startDate}
                  >
                    Add
                  </Button>
                </form>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium">Skills</p>
                {selectedProfile.skills.length === 0 ? (
                  <p className="text-muted-foreground text-xs">No skills listed yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {selectedProfile.skills.map((s) => (
                      <Badge key={s.id} variant="secondary">
                        {s.skillName}
                      </Badge>
                    ))}
                  </div>
                )}
                <form
                  className="flex items-end gap-2"
                  onSubmit={(e: FormEvent) => {
                    e.preventDefault();
                    submitAction(
                      () => api.addAlumniSkill(selectedProfile.id, { skillName: skillForm }),
                      () => {
                        setSkillForm("");
                        profiles.mutate();
                      },
                    );
                  }}
                >
                  <Input className="h-7 w-40" placeholder="Skill" value={skillForm} onChange={(e) => setSkillForm(e.target.value)} />
                  <Button type="submit" size="sm" className="h-7" disabled={!skillForm}>
                    Add
                  </Button>
                </form>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Companies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!companies.data || companies.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No companies yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {companies.data.map((c) => (
                <li key={c.id} className="py-2">
                  <span className="font-medium">{c.name}</span>
                  {c.industry ? <span className="text-muted-foreground"> — {c.industry}</span> : null}
                </li>
              ))}
            </ul>
          )}
          <Separator />
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              submitAction(
                () => api.createAlumniCompany({ name: companyForm.name, industry: companyForm.industry || undefined }),
                () => {
                  setCompanyForm({ name: "", industry: "" });
                  companies.mutate();
                },
              );
            }}
          >
            <Input
              className="w-40"
              placeholder="Company name"
              value={companyForm.name}
              onChange={(e) => setCompanyForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Input
              className="w-40"
              placeholder="Industry (optional)"
              value={companyForm.industry}
              onChange={(e) => setCompanyForm((f) => ({ ...f, industry: e.target.value }))}
            />
            <Button type="submit" size="sm" disabled={!companyForm.name}>
              Add company
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
