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
import type { MentorshipStatus, SurveyQuestion, SurveyQuestionType } from "@education-erp/api-client";

function mentorshipBadgeVariant(status: MentorshipStatus) {
  if (status === "ACTIVE") return "success" as const;
  if (status === "COMPLETED") return "secondary" as const;
  if (status === "DECLINED") return "destructive" as const;
  return "info" as const;
}

function surveyBadgeVariant(status: string) {
  if (status === "PUBLISHED") return "success" as const;
  if (status === "CLOSED") return "secondary" as const;
  return "outline" as const;
}

let questionIdCounter = 0;
function newQuestionId() {
  questionIdCounter += 1;
  return `q-${Date.now()}-${questionIdCounter}`;
}

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
  const surveys = useSWR("alumni-surveys", () => api.listAlumniSurveys());
  const mentorships = useSWR("alumni-mentorship", () => api.listAlumniMentorships());

  const [profileForm, setProfileForm] = useState({ studentId: "", graduationYear: new Date().getFullYear().toString() });
  const [companyForm, setCompanyForm] = useState({ name: "", industry: "" });
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [educationForm, setEducationForm] = useState({ institutionName: "", degree: "" });
  const [careerForm, setCareerForm] = useState({ companyId: "", jobTitle: "", startDate: "" });
  const [skillForm, setSkillForm] = useState("");
  const [achievementForm, setAchievementForm] = useState({ title: "", achievedAt: "" });
  const [surveyForm, setSurveyForm] = useState({ title: "", description: "" });
  const [surveyQuestions, setSurveyQuestions] = useState<SurveyQuestion[]>([]);
  const [expandedResponsesSurveyId, setExpandedResponsesSurveyId] = useState("");
  const surveyResponses = useSWR(
    expandedResponsesSurveyId ? ["alumni-survey-responses", expandedResponsesSurveyId] : null,
    () => api.listAlumniSurveyResponses(expandedResponsesSurveyId),
  );
  const [mentorshipForm, setMentorshipForm] = useState({ mentorAlumniProfileId: "", menteeStudentId: "", topic: "" });

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

              <div className="space-y-2">
                <p className="text-xs font-medium">Achievements</p>
                {selectedProfile.achievements.length === 0 ? (
                  <p className="text-muted-foreground text-xs">No achievements recorded yet.</p>
                ) : (
                  <ul className="text-xs">
                    {selectedProfile.achievements.map((a) => (
                      <li key={a.id}>
                        {a.title}
                        {a.achievedAt ? ` — ${new Date(a.achievedAt).toLocaleDateString()}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(e: FormEvent) => {
                    e.preventDefault();
                    submitAction(
                      () => api.addAlumniAchievement(selectedProfile.id, { title: achievementForm.title, achievedAt: achievementForm.achievedAt || undefined }),
                      () => {
                        setAchievementForm({ title: "", achievedAt: "" });
                        profiles.mutate();
                      },
                    );
                  }}
                >
                  <Input
                    className="h-7 w-40"
                    placeholder="Achievement"
                    value={achievementForm.title}
                    onChange={(e) => setAchievementForm((f) => ({ ...f, title: e.target.value }))}
                  />
                  <Input
                    className="h-7 w-32"
                    type="date"
                    value={achievementForm.achievedAt}
                    onChange={(e) => setAchievementForm((f) => ({ ...f, achievedAt: e.target.value }))}
                  />
                  <Button type="submit" size="sm" className="h-7" disabled={!achievementForm.title}>
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

      <Card>
        <CardHeader>
          <CardTitle>Surveys</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!surveys.data || surveys.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No surveys yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {surveys.data.map((s) => (
                <li key={s.id} className="space-y-1 rounded-md border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{s.title}</span>
                    <span className="flex items-center gap-2">
                      <Badge variant={surveyBadgeVariant(s.status)}>{s.status}</Badge>
                      {s.status === "DRAFT" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7"
                          onClick={() => submitAction(() => api.publishAlumniSurvey(s.id), () => surveys.mutate())}
                        >
                          Publish
                        </Button>
                      ) : null}
                      {s.status === "PUBLISHED" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7"
                          onClick={() => submitAction(() => api.closeAlumniSurvey(s.id), () => surveys.mutate())}
                        >
                          Close
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7"
                        onClick={() => setExpandedResponsesSurveyId(expandedResponsesSurveyId === s.id ? "" : s.id)}
                      >
                        Responses
                      </Button>
                    </span>
                  </div>
                  {expandedResponsesSurveyId === s.id ? (
                    <div className="bg-muted/30 rounded p-2 text-xs">
                      {!surveyResponses.data || surveyResponses.data.length === 0 ? (
                        <p className="text-muted-foreground">No responses yet.</p>
                      ) : (
                        <ul className="space-y-1">
                          {surveyResponses.data.map((r) => (
                            <li key={r.id}>
                              {r.alumniProfile?.student.firstName} {r.alumniProfile?.student.lastName}:{" "}
                              {r.answers.map((a) => a.value).join(", ")}
                            </li>
                          ))}
                        </ul>
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
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              submitAction(
                () => api.createAlumniSurvey({ title: surveyForm.title, description: surveyForm.description || undefined, questions: surveyQuestions }),
                () => {
                  setSurveyForm({ title: "", description: "" });
                  setSurveyQuestions([]);
                  surveys.mutate();
                },
              );
            }}
          >
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Title</Label>
                <Input
                  className="w-56"
                  value={surveyForm.title}
                  onChange={(e) => setSurveyForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description (optional)</Label>
                <Input
                  className="w-64"
                  value={surveyForm.description}
                  onChange={(e) => setSurveyForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              {surveyQuestions.map((q, i) => (
                <div key={q.id} className="flex flex-wrap items-end gap-2 rounded-md border p-2">
                  <Input
                    className="h-8 w-56"
                    placeholder="Question text"
                    value={q.text}
                    onChange={(e) =>
                      setSurveyQuestions((prev) => prev.map((qq, ii) => (ii === i ? { ...qq, text: e.target.value } : qq)))
                    }
                  />
                  <NativeSelect
                    className="h-8 w-36"
                    placeholder="Question type"
                    value={q.type}
                    onChange={(v) =>
                      setSurveyQuestions((prev) =>
                        prev.map((qq, ii) => (ii === i ? { ...qq, type: v as SurveyQuestionType } : qq)),
                      )
                    }
                    options={[
                      { value: "TEXT", label: "Text" },
                      { value: "RATING", label: "Rating (1-5)" },
                      { value: "SINGLE_CHOICE", label: "Single choice" },
                    ]}
                  />
                  {q.type === "SINGLE_CHOICE" ? (
                    <Input
                      className="h-8 w-56"
                      placeholder="Options, comma-separated"
                      value={(q.options ?? []).join(", ")}
                      onChange={(e) =>
                        setSurveyQuestions((prev) =>
                          prev.map((qq, ii) =>
                            ii === i
                              ? { ...qq, options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) }
                              : qq,
                          ),
                        )
                      }
                    />
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => setSurveyQuestions((prev) => prev.filter((_, ii) => ii !== i))}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setSurveyQuestions((prev) => [...prev, { id: newQuestionId(), text: "", type: "TEXT" }])}
              >
                + Add question
              </Button>
            </div>

            <Button type="submit" size="sm" disabled={!surveyForm.title || surveyQuestions.length === 0}>
              Create survey
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mentorship</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!mentorships.data || mentorships.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No mentorship pairings yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {mentorships.data.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    <span className="font-medium">
                      {m.mentorAlumniProfile?.student.firstName} {m.mentorAlumniProfile?.student.lastName}
                    </span>{" "}
                    <span className="text-muted-foreground">mentoring</span>{" "}
                    <span className="font-medium">
                      {m.menteeStudent?.firstName} {m.menteeStudent?.lastName}
                    </span>
                    {m.topic ? <span className="text-muted-foreground"> — {m.topic}</span> : null}
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge variant={mentorshipBadgeVariant(m.status)}>{m.status}</Badge>
                    {m.status === "ACTIVE" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7"
                        onClick={() => submitAction(() => api.completeAlumniMentorship(m.id), () => mentorships.mutate())}
                      >
                        Mark completed
                      </Button>
                    ) : null}
                  </span>
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
                () =>
                  api.createAlumniMentorship({
                    mentorAlumniProfileId: mentorshipForm.mentorAlumniProfileId,
                    menteeStudentId: mentorshipForm.menteeStudentId,
                    topic: mentorshipForm.topic || undefined,
                  }),
                () => {
                  setMentorshipForm({ mentorAlumniProfileId: "", menteeStudentId: "", topic: "" });
                  mentorships.mutate();
                },
              );
            }}
          >
            <div className="space-y-1">
              <Label className="text-xs">Mentor (alumnus)</Label>
              <NativeSelect
                className="w-48"
                placeholder="Select alumnus"
                value={mentorshipForm.mentorAlumniProfileId}
                onChange={(v) => setMentorshipForm((f) => ({ ...f, mentorAlumniProfileId: v }))}
                options={(profiles.data ?? []).map((p) => ({ value: p.id, label: `${p.student.firstName} ${p.student.lastName}` }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mentee (student)</Label>
              <NativeSelect
                className="w-48"
                placeholder="Select student"
                value={mentorshipForm.menteeStudentId}
                onChange={(v) => setMentorshipForm((f) => ({ ...f, menteeStudentId: v }))}
                options={(students.data ?? []).map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}` }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Topic (optional)</Label>
              <Input
                className="w-48"
                value={mentorshipForm.topic}
                onChange={(e) => setMentorshipForm((f) => ({ ...f, topic: e.target.value }))}
              />
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={!mentorshipForm.mentorAlumniProfileId || !mentorshipForm.menteeStudentId}
            >
              Create pairing
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
