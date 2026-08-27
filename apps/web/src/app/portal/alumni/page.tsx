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
import { Textarea } from "@/components/ui/textarea";
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

export default function PortalAlumniPage() {
  const profile = useSWR("portal-alumni-profile", () => api.getOwnAlumniProfile());
  const companies = useSWR("portal-alumni-companies", () => api.listOwnAlumniCompanies());
  const [profileForm, setProfileForm] = useState({ currentOccupation: "", currentEmployer: "", currentLocation: "", bio: "" });
  const [skillForm, setSkillForm] = useState("");
  const [educationForm, setEducationForm] = useState({ institutionName: "", degree: "" });
  const [careerForm, setCareerForm] = useState({ companyId: "", jobTitle: "", startDate: "" });

  // No alumni profile exists for this account yet (not graduated, or
  // the registrar hasn't created one) — a clear message, not a
  // crash. Same "gap notice instead of a blank page" pattern used
  // elsewhere in this project (e.g. the library staff-bridge notice).
  if (profile.error) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold">Alumni</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          You don&apos;t have an alumni profile yet. Once your institution creates one for you (usually after graduation),
          it will appear here.
        </p>
      </div>
    );
  }

  const data = profile.data;

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
        </>
      )}
    </div>
  );
}
