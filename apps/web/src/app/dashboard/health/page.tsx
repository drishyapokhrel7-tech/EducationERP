"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { PersonPicker, studentToPersonOption } from "@/components/person-picker";
import { Separator } from "@/components/ui/separator";
import { EntityCard } from "@/components/dashboard/entity-card";
import { ListPager } from "@/components/dashboard/list-pager";
import { api } from "@/lib/api";
import { downloadBlob } from "@/lib/download";
import { submitAction, submitDelete } from "@/lib/submit-action";
import type { BloodGroup, ImportResult } from "@education-erp/api-client";

const BLOOD_GROUP_OPTIONS: { value: BloodGroup; label: string }[] = [
  { value: "A_POSITIVE", label: "A+" },
  { value: "A_NEGATIVE", label: "A−" },
  { value: "B_POSITIVE", label: "B+" },
  { value: "B_NEGATIVE", label: "B−" },
  { value: "AB_POSITIVE", label: "AB+" },
  { value: "AB_NEGATIVE", label: "AB−" },
  { value: "O_POSITIVE", label: "O+" },
  { value: "O_NEGATIVE", label: "O−" },
  { value: "UNKNOWN", label: "Unknown" },
];

export default function HealthPage() {
  const studentsPicker = useSWR("students-picker", () => api.listStudentsPicker());

  const [profileStudentId, setProfileStudentId] = useState("");
  const profile = useSWR(profileStudentId ? ["health-profile", profileStudentId] : null, () =>
    api.getHealthProfile(profileStudentId),
  );

  const [profileForm, setProfileForm] = useState({
    bloodGroup: "" as BloodGroup | "",
    allergies: "",
    chronicConditions: "",
    currentMedications: "",
    emergencyMedicalNotes: "",
  });

  useEffect(() => {
    // Deferred to a microtask so this setState doesn't run synchronously
    // within the effect body — same restructuring CaptchaField's own
    // load() effect already uses for the same
    // react-hooks/set-state-in-effect reasoning.
    void Promise.resolve().then(() => {
      if (profile.data) {
        setProfileForm({
          bloodGroup: profile.data.bloodGroup ?? "",
          allergies: profile.data.allergies ?? "",
          chronicConditions: profile.data.chronicConditions ?? "",
          currentMedications: profile.data.currentMedications ?? "",
          emergencyMedicalNotes: profile.data.emergencyMedicalNotes ?? "",
        });
      } else if (profile.data === null) {
        setProfileForm({ bloodGroup: "", allergies: "", chronicConditions: "", currentMedications: "", emergencyMedicalNotes: "" });
      }
    });
  }, [profile.data]);

  const [visitPage, setVisitPage] = useState(1);
  const [visitStudentFilter, setVisitStudentFilter] = useState("");
  const visits = useSWR(["health-visits", visitPage, visitStudentFilter], () =>
    api.listAllHealthVisits({ page: visitPage, studentId: visitStudentFilter || undefined }),
  );

  const [visitForm, setVisitForm] = useState({
    studentId: "",
    visitDate: "",
    reason: "",
    treatmentGiven: "",
    referredExternally: false,
  });

  const [editingVisitId, setEditingVisitId] = useState<string | null>(null);
  const [editVisitForm, setEditVisitForm] = useState({
    visitDate: "",
    reason: "",
    treatmentGiven: "",
    referredExternally: false,
  });

  const importFileRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);

  async function handleImport() {
    const file = importFileRef.current?.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const result = await api.importHealthVisits(file);
      setImportResult(result);
      visits.mutate();
      if (importFileRef.current) importFileRef.current.value = "";
      toast.success(`${result.created} created, ${result.updated} updated (of ${result.totalRows} row(s))`);
    } catch {
      toast.error("Import failed — check the file is a valid Excel/CSV file");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Health &amp; Medical Records</h1>
        <p className="text-muted-foreground text-sm">
          One profile per student (allergies, conditions, medications) plus a log of health-office visits.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Health Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Student</Label>
            <PersonPicker
              className="w-56"
              placeholder="Select student"
              value={profileStudentId}
              onChange={setProfileStudentId}
              options={(studentsPicker.data ?? []).map(studentToPersonOption)}
            />
          </div>

          {profileStudentId ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                submitAction(
                  () =>
                    api.updateHealthProfile(profileStudentId, {
                      bloodGroup: profileForm.bloodGroup || undefined,
                      allergies: profileForm.allergies || undefined,
                      chronicConditions: profileForm.chronicConditions || undefined,
                      currentMedications: profileForm.currentMedications || undefined,
                      emergencyMedicalNotes: profileForm.emergencyMedicalNotes || undefined,
                    }),
                  () => profile.mutate(),
                );
              }}
            >
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-2">
                  <Label>Blood group</Label>
                  <NativeSelect
                    className="w-28"
                    placeholder="Select"
                    value={profileForm.bloodGroup}
                    onChange={(v) => setProfileForm((f) => ({ ...f, bloodGroup: v as BloodGroup }))}
                    options={BLOOD_GROUP_OPTIONS}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Allergies</Label>
                <Textarea
                  value={profileForm.allergies}
                  onChange={(e) => setProfileForm((f) => ({ ...f, allergies: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Chronic conditions</Label>
                <Textarea
                  value={profileForm.chronicConditions}
                  onChange={(e) => setProfileForm((f) => ({ ...f, chronicConditions: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Current medications</Label>
                <Textarea
                  value={profileForm.currentMedications}
                  onChange={(e) => setProfileForm((f) => ({ ...f, currentMedications: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Emergency medical notes</Label>
                <Textarea
                  value={profileForm.emergencyMedicalNotes}
                  onChange={(e) => setProfileForm((f) => ({ ...f, emergencyMedicalNotes: e.target.value }))}
                />
              </div>
              <Button type="submit">Save profile</Button>
            </form>
          ) : (
            <p className="text-muted-foreground text-sm">Select a student to view or edit their health profile.</p>
          )}
        </CardContent>
      </Card>

      <EntityCard
        id="health-visits"
        title="Health Office Visits"
        emptyLabel="No visits match these filters."
        items={visits.data?.data}
        footer={
          <>
            {visits.data ? (
              <ListPager
                page={visits.data.page}
                totalPages={visits.data.totalPages}
                onPrev={() => setVisitPage((p) => Math.max(1, p - 1))}
                onNext={() => setVisitPage((p) => p + 1)}
              />
            ) : null}
            {editingVisitId ? (
              <form
                className="flex flex-wrap items-end gap-3 border-b pb-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitAction(
                    () =>
                      api.updateHealthVisit(editingVisitId, {
                        visitDate: editVisitForm.visitDate,
                        reason: editVisitForm.reason,
                        treatmentGiven: editVisitForm.treatmentGiven || undefined,
                        referredExternally: editVisitForm.referredExternally,
                      }),
                    () => {
                      setEditingVisitId(null);
                      visits.mutate();
                    },
                  );
                }}
              >
                <div className="space-y-2">
                  <Label>Visit date</Label>
                  <Input
                    required
                    type="date"
                    value={editVisitForm.visitDate}
                    onChange={(e) => setEditVisitForm((f) => ({ ...f, visitDate: e.target.value }))}
                  />
                </div>
                <div className="w-full space-y-2">
                  <Label>Reason</Label>
                  <Textarea
                    value={editVisitForm.reason}
                    onChange={(e) => setEditVisitForm((f) => ({ ...f, reason: e.target.value }))}
                  />
                </div>
                <div className="w-full space-y-2">
                  <Label>Treatment given (optional)</Label>
                  <Textarea
                    value={editVisitForm.treatmentGiven}
                    onChange={(e) => setEditVisitForm((f) => ({ ...f, treatmentGiven: e.target.value }))}
                  />
                </div>
                <label className="flex items-center gap-2 pb-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editVisitForm.referredExternally}
                    onChange={(e) => setEditVisitForm((f) => ({ ...f, referredExternally: e.target.checked }))}
                  />
                  Referred externally (hospital/clinic)
                </label>
                <Button type="submit" size="sm" disabled={!editVisitForm.reason || !editVisitForm.visitDate}>
                  Save
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setEditingVisitId(null)}>
                  Cancel
                </Button>
              </form>
            ) : null}
          </>
        }
        renderItem={(v: {
          id: string;
          visitDate: string;
          reason: string;
          treatmentGiven: string | null;
          referredExternally: boolean;
          recordedBy: { firstName: string; lastName: string };
          student: { firstName: string; lastName: string; studentCode: string };
        }) => (
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <span>
                {v.student.firstName} {v.student.lastName}{" "}
                <span className="text-muted-foreground">({v.student.studentCode})</span> ·{" "}
                {new Date(v.visitDate).toLocaleDateString()}
                {v.referredExternally ? <Badge variant="destructive" className="ml-2">Referred externally</Badge> : null}
              </span>
              <p className="text-muted-foreground text-xs">{v.reason}</p>
              {v.treatmentGiven ? <p className="text-muted-foreground text-xs">Treatment: {v.treatmentGiven}</p> : null}
              <p className="text-muted-foreground text-xs">
                Recorded by {v.recordedBy.firstName} {v.recordedBy.lastName}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingVisitId(v.id);
                  setEditVisitForm({
                    visitDate: v.visitDate.slice(0, 10),
                    reason: v.reason,
                    treatmentGiven: v.treatmentGiven ?? "",
                    referredExternally: v.referredExternally,
                  });
                }}
              >
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => submitDelete(() => api.deleteHealthVisit(v.id), () => visits.mutate())}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
      >
        <div className="flex flex-wrap items-end gap-2 pb-3">
          <input ref={importFileRef} type="file" accept=".csv,.xlsx" className="text-sm" disabled={importing} />
          <Button type="button" size="sm" variant="outline" disabled={importing} onClick={handleImport}>
            {importing ? "Importing…" : "Import"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => downloadBlob(() => api.downloadHealthVisitImportTemplate(), "health-visits-import-template.xlsx")}
          >
            Download template
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => downloadBlob(() => api.exportHealthVisitsEditable(), "health-visits-editable.xlsx")}
          >
            Download editable copy
          </Button>
        </div>
        {importResult ? (
          <div className="pb-3 text-sm">
            <p>
              {importResult.created} created, {importResult.updated} updated (of {importResult.totalRows} row(s)).
            </p>
            {importResult.errors.length > 0 ? (
              <ul className="text-destructive mt-2 list-disc space-y-1 pl-5">
                {importResult.errors.map((e, i) => (
                  <li key={i}>
                    Row {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <Separator className="mb-3" />

        <div className="flex flex-wrap items-end gap-3 pb-3">
          <div className="space-y-1">
            <Label className="text-xs">Filter by student</Label>
            <PersonPicker
              className="w-56"
              placeholder="All students"
              value={visitStudentFilter}
              onChange={(v) => {
                setVisitStudentFilter(v);
                setVisitPage(1);
              }}
              options={(studentsPicker.data ?? []).map(studentToPersonOption)}
            />
          </div>
        </div>

        <Separator className="mb-3" />

        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            submitAction(
              () =>
                api.createStudentHealthVisit(visitForm.studentId, {
                  visitDate: visitForm.visitDate,
                  reason: visitForm.reason,
                  treatmentGiven: visitForm.treatmentGiven || undefined,
                  referredExternally: visitForm.referredExternally,
                }),
              () => {
                setVisitForm((f) => ({ ...f, visitDate: "", reason: "", treatmentGiven: "", referredExternally: false }));
                visits.mutate();
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label>Student</Label>
            <PersonPicker
              className="w-56"
              placeholder="Select student"
              value={visitForm.studentId}
              onChange={(v) => setVisitForm((f) => ({ ...f, studentId: v }))}
              options={(studentsPicker.data ?? []).map(studentToPersonOption)}
            />
          </div>
          <div className="space-y-2">
            <Label>Visit date</Label>
            <Input
              required
              type="date"
              value={visitForm.visitDate}
              onChange={(e) => setVisitForm((f) => ({ ...f, visitDate: e.target.value }))}
            />
          </div>
          <div className="w-full space-y-2">
            <Label>Reason</Label>
            <Textarea value={visitForm.reason} onChange={(e) => setVisitForm((f) => ({ ...f, reason: e.target.value }))} />
          </div>
          <div className="w-full space-y-2">
            <Label>Treatment given (optional)</Label>
            <Textarea
              value={visitForm.treatmentGiven}
              onChange={(e) => setVisitForm((f) => ({ ...f, treatmentGiven: e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={visitForm.referredExternally}
              onChange={(e) => setVisitForm((f) => ({ ...f, referredExternally: e.target.checked }))}
            />
            Referred externally (hospital/clinic)
          </label>
          <Button type="submit" disabled={!visitForm.studentId || !visitForm.reason || !visitForm.visitDate}>
            Add
          </Button>
        </form>
      </EntityCard>
    </div>
  );
}
