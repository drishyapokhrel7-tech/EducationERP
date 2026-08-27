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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { ApplicationStatus, MentorshipStatus, OpportunityType } from "@education-erp/api-client";

function mentorshipBadgeVariant(status: MentorshipStatus) {
  if (status === "ACTIVE") return "success" as const;
  if (status === "COMPLETED") return "secondary" as const;
  if (status === "DECLINED") return "destructive" as const;
  return "info" as const;
}

function applicationBadgeVariant(status: ApplicationStatus) {
  if (status === "ACCEPTED") return "success" as const;
  if (status === "SHORTLISTED") return "info" as const;
  if (status === "REJECTED" || status === "WITHDRAWN") return "destructive" as const;
  return "outline" as const;
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

export default function PortalAlumniPage() {
  const profile = useSWR("portal-alumni-profile", () => api.getOwnAlumniProfile());
  const companies = useSWR("portal-alumni-companies", () => api.listOwnAlumniCompanies());
  const surveys = useSWR("portal-alumni-surveys", () => api.listPublishedAlumniSurveys());
  const mentorshipsAsMentor = useSWR("portal-mentorships-mentor", () => api.listOwnMentorshipsAsMentor());
  const mentorshipsAsMentee = useSWR("portal-mentorships-mentee", () => api.listOwnMentorshipsAsMentee());
  const [profileForm, setProfileForm] = useState({ currentOccupation: "", currentEmployer: "", currentLocation: "", bio: "" });
  const [skillForm, setSkillForm] = useState("");
  const [educationForm, setEducationForm] = useState({ institutionName: "", degree: "" });
  const [careerForm, setCareerForm] = useState({ companyId: "", jobTitle: "", startDate: "" });
  const [achievementForm, setAchievementForm] = useState({ title: "", description: "" });
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, Record<string, string>>>({});
  // Surveys already answered this session — the survey list itself
  // doesn't say whether *I've* responded (that's per-alumnus, not a
  // survey-level fact), so this is tracked locally after a successful
  // submit rather than adding a dedicated "have I responded" endpoint
  // for what's otherwise a one-time action.
  const [respondedSurveyIds, setRespondedSurveyIds] = useState<Set<string>>(new Set());
  const opportunities = useSWR("portal-career-opportunities", () => api.listApprovedCareerOpportunities());
  const ownApplications = useSWR("portal-career-applications", () => api.listOwnCareerApplications());
  const careerServices = useSWR("portal-career-services", () => api.listActiveCareerServices());
  const [coverNotes, setCoverNotes] = useState<Record<string, string>>({});
  const [opportunityForm, setOpportunityForm] = useState({ companyId: "", title: "", type: "JOB" as OpportunityType, description: "", location: "" });

  const data = profile.data;

  // Career opportunities, my applications, and career services — none
  // of these depend on having an alumni profile (a current student can
  // browse/apply/withdraw too, same "not alumni-only" reasoning as the
  // mentee card above). The one exception is submitting a new
  // opportunity posting, gated inline below since only an alumnus can
  // post a job/internship on an employer's behalf.
  const careerCards = (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Career opportunities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!opportunities.data || opportunities.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No open opportunities right now.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {opportunities.data.map((o) => {
                const already = ownApplications.data?.find((a) => a.opportunityId === o.id);
                return (
                  <li key={o.id} className="space-y-1 rounded-md border p-2">
                    <p className="font-medium">
                      {o.title} <span className="text-muted-foreground">at {o.company.name}</span>{" "}
                      <Badge variant="outline">{o.type}</Badge>
                      {o.status === "CLOSED" ? (
                        <Badge variant="secondary" className="ml-1">
                          Closed
                        </Badge>
                      ) : null}
                    </p>
                    <p className="text-muted-foreground text-xs">{o.description}</p>
                    {already ? (
                      <Badge variant={applicationBadgeVariant(already.status)}>Applied — {already.status}</Badge>
                    ) : o.status === "APPROVED" ? (
                      <form
                        className="flex flex-wrap items-end gap-2"
                        onSubmit={(e: FormEvent) => {
                          e.preventDefault();
                          submitAction(
                            () => api.applyToCareerOpportunity(o.id, { coverNote: coverNotes[o.id] || undefined }),
                            () => {
                              setCoverNotes((prev) => ({ ...prev, [o.id]: "" }));
                              ownApplications.mutate();
                            },
                          );
                        }}
                      >
                        <Input
                          className="h-7 w-56"
                          placeholder="Cover note (optional)"
                          value={coverNotes[o.id] ?? ""}
                          onChange={(e) => setCoverNotes((prev) => ({ ...prev, [o.id]: e.target.value }))}
                        />
                        <Button type="submit" size="sm" className="h-7">
                          Apply
                        </Button>
                      </form>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          {data ? (
            <>
              <Separator />
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  submitAction(
                    () =>
                      api.createOwnCareerOpportunity({
                        companyId: opportunityForm.companyId,
                        title: opportunityForm.title,
                        type: opportunityForm.type,
                        description: opportunityForm.description,
                        location: opportunityForm.location || undefined,
                      }),
                    () => {
                      setOpportunityForm({ companyId: "", title: "", type: "JOB", description: "", location: "" });
                      toast.success("Submitted for review");
                    },
                  );
                }}
              >
                <NativeSelect
                  className="h-7 w-36"
                  placeholder="Company"
                  value={opportunityForm.companyId}
                  onChange={(v) => setOpportunityForm((f) => ({ ...f, companyId: v }))}
                  options={(companies.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
                />
                <Input
                  className="h-7 w-36"
                  placeholder="Title"
                  value={opportunityForm.title}
                  onChange={(e) => setOpportunityForm((f) => ({ ...f, title: e.target.value }))}
                />
                <Input
                  className="h-7 w-48"
                  placeholder="Description"
                  value={opportunityForm.description}
                  onChange={(e) => setOpportunityForm((f) => ({ ...f, description: e.target.value }))}
                />
                <Button
                  type="submit"
                  size="sm"
                  className="h-7"
                  disabled={!opportunityForm.companyId || !opportunityForm.title || !opportunityForm.description}
                >
                  Submit a listing
                </Button>
              </form>
              <p className="text-muted-foreground text-xs">Submitted listings are reviewed by your institution before appearing here.</p>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My applications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!ownApplications.data || ownApplications.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No applications yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {ownApplications.data.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2">
                  <span>
                    {a.opportunity?.title} <span className="text-muted-foreground">at {a.opportunity?.company.name}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge variant={applicationBadgeVariant(a.status)}>{a.status}</Badge>
                    {!["REJECTED", "ACCEPTED", "WITHDRAWN"].includes(a.status) ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7"
                        onClick={() => submitAction(() => api.withdrawOwnCareerApplication(a.id), () => ownApplications.mutate())}
                      >
                        Withdraw
                      </Button>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Career services</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!careerServices.data || careerServices.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No career services listed right now.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {careerServices.data.map((s) => (
                <li key={s.id}>
                  <span className="font-medium">{s.name}</span>
                  {s.description ? <span className="text-muted-foreground"> — {s.description}</span> : null}
                  {s.contactEmail ? <span className="text-muted-foreground"> ({s.contactEmail})</span> : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
  // A mentee's own mentorships don't depend on having an alumni
  // profile at all — a current student receiving mentorship from an
  // alumnus mentor isn't necessarily graduated. Rendered regardless of
  // whether an alumni profile exists, unlike every other card below.
  const menteeCard = (
    <Card>
      <CardHeader>
        <CardTitle>My mentorships</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {!mentorshipsAsMentee.data || mentorshipsAsMentee.data.length === 0 ? (
          <p className="text-muted-foreground text-sm">You&apos;re not currently paired with a mentor.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {mentorshipsAsMentee.data.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2">
                <span>
                  {m.mentorAlumniProfile?.student.firstName} {m.mentorAlumniProfile?.student.lastName}
                  {m.topic ? <span className="text-muted-foreground"> — {m.topic}</span> : null}
                </span>
                <Badge variant={mentorshipBadgeVariant(m.status)}>{m.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );

  // No alumni profile exists for this account yet (not graduated, or
  // the registrar hasn't created one) — a clear message, not a
  // crash, plus the mentee card above (independent of a profile).
  // Same "gap notice instead of a blank page" pattern used elsewhere
  // in this project (e.g. the library staff-bridge notice).
  if (profile.error) {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Alumni</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            You don&apos;t have an alumni profile yet. Once your institution creates one for you (usually after graduation),
            it will appear here.
          </p>
        </div>
        {menteeCard}
        {careerCards}
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Alumni</h1>
        <p className="text-muted-foreground text-sm">Manage your own alumni profile — visible to your institution&apos;s staff.</p>
      </div>

      {!data ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>My profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground text-sm">Class of {data.graduationYear}</p>
              {data.currentOccupation || data.currentEmployer ? (
                <p className="text-sm">
                  {data.currentOccupation}
                  {data.currentEmployer ? ` at ${data.currentEmployer}` : ""}
                </p>
              ) : null}
              {data.bio ? <p className="text-sm">{data.bio}</p> : null}
              <form
                className="space-y-2"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  submitAction(
                    () =>
                      api.updateOwnAlumniProfile({
                        currentOccupation: profileForm.currentOccupation || undefined,
                        currentEmployer: profileForm.currentEmployer || undefined,
                        currentLocation: profileForm.currentLocation || undefined,
                        bio: profileForm.bio || undefined,
                      }),
                    () => profile.mutate(),
                  );
                }}
              >
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Current occupation</Label>
                    <Input
                      value={profileForm.currentOccupation}
                      onChange={(e) => setProfileForm((f) => ({ ...f, currentOccupation: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Current employer</Label>
                    <Input
                      value={profileForm.currentEmployer}
                      onChange={(e) => setProfileForm((f) => ({ ...f, currentEmployer: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Bio</Label>
                  <Textarea value={profileForm.bio} onChange={(e) => setProfileForm((f) => ({ ...f, bio: e.target.value }))} />
                </div>
                <Button type="submit" size="sm">
                  Update profile
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Education</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.education.length === 0 ? (
                <p className="text-muted-foreground text-sm">No education records yet.</p>
              ) : (
                <ul className="text-sm">
                  {data.education.map((e) => (
                    <li key={e.id}>
                      {e.degree} — {e.institutionName}
                    </li>
                  ))}
                </ul>
              )}
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  submitAction(
                    () => api.addOwnAlumniEducation(educationForm),
                    () => {
                      setEducationForm({ institutionName: "", degree: "" });
                      profile.mutate();
                    },
                  );
                }}
              >
                <Input
                  className="h-8 w-40"
                  placeholder="Institution"
                  value={educationForm.institutionName}
                  onChange={(e) => setEducationForm((f) => ({ ...f, institutionName: e.target.value }))}
                />
                <Input
                  className="h-8 w-32"
                  placeholder="Degree"
                  value={educationForm.degree}
                  onChange={(e) => setEducationForm((f) => ({ ...f, degree: e.target.value }))}
                />
                <Button type="submit" size="sm" disabled={!educationForm.institutionName || !educationForm.degree}>
                  Add
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Career history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.careerHistory.length === 0 ? (
                <p className="text-muted-foreground text-sm">No career history yet.</p>
              ) : (
                <ul className="text-sm">
                  {data.careerHistory.map((c) => (
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
                    () => api.addOwnAlumniCareerHistory(careerForm),
                    () => {
                      setCareerForm({ companyId: "", jobTitle: "", startDate: "" });
                      profile.mutate();
                    },
                  );
                }}
              >
                <NativeSelect
                  className="h-8 w-36"
                  placeholder="Company"
                  value={careerForm.companyId}
                  onChange={(v) => setCareerForm((f) => ({ ...f, companyId: v }))}
                  options={(companies.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
                />
                <Input
                  className="h-8 w-32"
                  placeholder="Job title"
                  value={careerForm.jobTitle}
                  onChange={(e) => setCareerForm((f) => ({ ...f, jobTitle: e.target.value }))}
                />
                <Input
                  className="h-8 w-32"
                  type="date"
                  value={careerForm.startDate}
                  onChange={(e) => setCareerForm((f) => ({ ...f, startDate: e.target.value }))}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!careerForm.companyId || !careerForm.jobTitle || !careerForm.startDate}
                >
                  Add
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Skills</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.skills.length === 0 ? (
                <p className="text-muted-foreground text-sm">No skills listed yet.</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {data.skills.map((s) => (
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
                    () => api.addOwnAlumniSkill({ skillName: skillForm }),
                    () => {
                      setSkillForm("");
                      profile.mutate();
                    },
                  );
                }}
              >
                <Input className="h-8 w-40" placeholder="Skill" value={skillForm} onChange={(e) => setSkillForm(e.target.value)} />
                <Button type="submit" size="sm" disabled={!skillForm}>
                  Add
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Achievements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.achievements.length === 0 ? (
                <p className="text-muted-foreground text-sm">No achievements listed yet.</p>
              ) : (
                <ul className="text-sm">
                  {data.achievements.map((a) => (
                    <li key={a.id}>
                      {a.title}
                      {a.achievedAt ? <span className="text-muted-foreground"> — {new Date(a.achievedAt).toLocaleDateString()}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  submitAction(
                    () => api.addOwnAlumniAchievement({ title: achievementForm.title, description: achievementForm.description || undefined }),
                    () => {
                      setAchievementForm({ title: "", description: "" });
                      profile.mutate();
                    },
                  );
                }}
              >
                <Input
                  className="h-8 w-40"
                  placeholder="Achievement"
                  value={achievementForm.title}
                  onChange={(e) => setAchievementForm((f) => ({ ...f, title: e.target.value }))}
                />
                <Button type="submit" size="sm" disabled={!achievementForm.title}>
                  Add
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Surveys</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!surveys.data || surveys.data.length === 0 ? (
                <p className="text-muted-foreground text-sm">No surveys right now.</p>
              ) : (
                surveys.data.map((survey) => {
                  const answered = respondedSurveyIds.has(survey.id);
                  const closed = survey.status === "CLOSED";
                  return (
                    <div key={survey.id} className="space-y-2 rounded-md border p-3">
                      <p className="text-sm font-medium">{survey.title}</p>
                      {survey.description ? <p className="text-muted-foreground text-xs">{survey.description}</p> : null}
                      {answered ? (
                        <p className="text-muted-foreground text-xs">Thanks — your response was recorded.</p>
                      ) : closed ? (
                        <p className="text-muted-foreground text-xs">This survey is closed.</p>
                      ) : (
                        <form
                          className="space-y-2"
                          onSubmit={(e: FormEvent) => {
                            e.preventDefault();
                            const answers = survey.questions.map((q) => ({
                              questionId: q.id,
                              value: surveyAnswers[survey.id]?.[q.id] ?? "",
                            }));
                            submitAction(
                              () => api.submitOwnAlumniSurveyResponse(survey.id, { answers }),
                              () => setRespondedSurveyIds((prev) => new Set(prev).add(survey.id)),
                            );
                          }}
                        >
                          {survey.questions.map((q) => (
                            <div key={q.id} className="space-y-1">
                              <Label className="text-xs">{q.text}</Label>
                              {q.type === "SINGLE_CHOICE" ? (
                                <NativeSelect
                                  className="h-8 w-56"
                                  placeholder="Choose one"
                                  value={surveyAnswers[survey.id]?.[q.id] ?? ""}
                                  onChange={(v) =>
                                    setSurveyAnswers((prev) => ({ ...prev, [survey.id]: { ...prev[survey.id], [q.id]: v } }))
                                  }
                                  options={(q.options ?? []).map((o) => ({ value: o, label: o }))}
                                />
                              ) : q.type === "RATING" ? (
                                <Input
                                  className="h-8 w-20"
                                  type="number"
                                  min={1}
                                  max={5}
                                  value={surveyAnswers[survey.id]?.[q.id] ?? ""}
                                  onChange={(e) =>
                                    setSurveyAnswers((prev) => ({
                                      ...prev,
                                      [survey.id]: { ...prev[survey.id], [q.id]: e.target.value },
                                    }))
                                  }
                                />
                              ) : (
                                <Input
                                  className="h-8 w-full"
                                  value={surveyAnswers[survey.id]?.[q.id] ?? ""}
                                  onChange={(e) =>
                                    setSurveyAnswers((prev) => ({
                                      ...prev,
                                      [survey.id]: { ...prev[survey.id], [q.id]: e.target.value },
                                    }))
                                  }
                                />
                              )}
                            </div>
                          ))}
                          <Button type="submit" size="sm">
                            Submit response
                          </Button>
                        </form>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mentoring</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {!mentorshipsAsMentor.data || mentorshipsAsMentor.data.length === 0 ? (
                <p className="text-muted-foreground text-sm">No mentorship requests yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {mentorshipsAsMentor.data.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2">
                      <span>
                        {m.menteeStudent?.firstName} {m.menteeStudent?.lastName}
                        {m.topic ? <span className="text-muted-foreground"> — {m.topic}</span> : null}
                      </span>
                      <span className="flex items-center gap-2">
                        <Badge variant={mentorshipBadgeVariant(m.status)}>{m.status}</Badge>
                        {m.status === "REQUESTED" ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7"
                              onClick={() =>
                                submitAction(
                                  () => api.respondOwnMentorship(m.id, { status: "ACTIVE" }),
                                  () => mentorshipsAsMentor.mutate(),
                                )
                              }
                            >
                              Accept
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7"
                              onClick={() =>
                                submitAction(
                                  () => api.respondOwnMentorship(m.id, { status: "DECLINED" }),
                                  () => mentorshipsAsMentor.mutate(),
                                )
                              }
                            >
                              Decline
                            </Button>
                          </>
                        ) : null}
                        {m.status === "ACTIVE" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7"
                            onClick={() => submitAction(() => api.completeOwnMentorship(m.id), () => mentorshipsAsMentor.mutate())}
                          >
                            Mark completed
                          </Button>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {menteeCard}
          {careerCards}
        </>
      )}
    </div>
  );
}
