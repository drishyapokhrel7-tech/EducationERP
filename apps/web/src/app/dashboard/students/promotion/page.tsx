"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import type { BulkPromoteEntryInput, BulkPromoteResult, PromotionAction } from "@education-erp/api-client";

const ACTION_OPTIONS: { value: PromotionAction; label: string }[] = [
  { value: "PROMOTE", label: "Promote" },
  { value: "RETAIN", label: "Retain (repeat)" },
  { value: "GRADUATE", label: "Graduate" },
];

interface RowState {
  enrollmentId: string;
  action: PromotionAction;
  targetProgramId: string;
  targetSemesterId: string;
  targetSectionId: string;
}

export default function PromotionPage() {
  const programs = useSWR("programs", () => api.listPrograms());
  const semesters = useSWR("semesters", () => api.listSemesters());
  const sections = useSWR("sections", () => api.listSections());

  const [sourceProgramId, setSourceProgramId] = useState("");
  const [sourceSemesterId, setSourceSemesterId] = useState("");
  const cohort = useSWR(
    sourceProgramId && sourceSemesterId ? ["promotion-cohort", sourceProgramId, sourceSemesterId] : null,
    () =>
      api.listAllEnrollments({
        programId: sourceProgramId,
        semesterId: sourceSemesterId,
        status: "ACTIVE",
        pageSize: 100,
      }),
  );

  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [defaultTarget, setDefaultTarget] = useState({ programId: "", semesterId: "", sectionId: "" });
  const [result, setResult] = useState<BulkPromoteResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function loadCohortIntoRows() {
    const next: Record<string, RowState> = {};
    for (const en of cohort.data?.data ?? []) {
      next[en.id] = { enrollmentId: en.id, action: "PROMOTE", targetProgramId: "", targetSemesterId: "", targetSectionId: "" };
    }
    setRows(next);
    setResult(null);
  }

  function applyDefaultsToAll() {
    setRows((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        if (next[id].action === "GRADUATE") continue;
        next[id] = {
          ...next[id],
          targetProgramId: defaultTarget.programId,
          targetSemesterId: defaultTarget.semesterId,
          targetSectionId: defaultTarget.sectionId,
        };
      }
      return next;
    });
  }

  function updateRow(id: string, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function submit() {
    const entries: BulkPromoteEntryInput[] = Object.values(rows).map((r) => ({
      enrollmentId: r.enrollmentId,
      action: r.action,
      targetProgramId: r.action === "GRADUATE" ? undefined : r.targetProgramId || undefined,
      targetSemesterId: r.action === "GRADUATE" ? undefined : r.targetSemesterId || undefined,
      targetSectionId: r.action === "GRADUATE" ? undefined : r.targetSectionId || undefined,
    }));
    setSubmitting(true);
    try {
      const res = await api.bulkPromote({ entries });
      setResult(res);
      setRows({});
      cohort.mutate();
      toast.success(`${res.promoted} promoted, ${res.retained} retained, ${res.graduated} graduated`);
    } catch {
      toast.error("Bulk promotion failed");
    } finally {
      setSubmitting(false);
    }
  }

  const rowList = Object.values(rows);
  const canSubmit =
    rowList.length > 0 &&
    rowList.every((r) => r.action === "GRADUATE" || (r.targetProgramId && r.targetSemesterId));

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Promotion &amp; Graduation</h1>
        <p className="text-muted-foreground text-sm">
          Year-end batch action: close out a cohort&apos;s current enrollment and either move each student into a
          new program/semester, hold them back in the same one, or graduate them.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Pick the cohort</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label>Current program</Label>
            <NativeSelect
              className="w-48"
              placeholder="Select program"
              value={sourceProgramId}
              onChange={setSourceProgramId}
              options={(programs.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Current semester</Label>
            <NativeSelect
              className="w-48"
              placeholder="Select semester"
              value={sourceSemesterId}
              onChange={setSourceSemesterId}
              options={(semesters.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
            />
          </div>
          <Button type="button" disabled={!sourceProgramId || !sourceSemesterId || !cohort.data} onClick={loadCohortIntoRows}>
            Load {cohort.data?.data.length ?? 0} active student(s)
          </Button>
        </CardContent>
      </Card>

      {rowList.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>2. Set a default target, then review each student</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-2">
                <Label>Default target program</Label>
                <NativeSelect
                  className="w-44"
                  placeholder="Select program"
                  value={defaultTarget.programId}
                  onChange={(v) => setDefaultTarget((f) => ({ ...f, programId: v, sectionId: "" }))}
                  options={(programs.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Default target semester</Label>
                <NativeSelect
                  className="w-44"
                  placeholder="Select semester"
                  value={defaultTarget.semesterId}
                  onChange={(v) => setDefaultTarget((f) => ({ ...f, semesterId: v, sectionId: "" }))}
                  options={(semesters.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Default target section (optional)</Label>
                <NativeSelect
                  className="w-40"
                  placeholder="None"
                  value={defaultTarget.sectionId}
                  onChange={(v) => setDefaultTarget((f) => ({ ...f, sectionId: v }))}
                  options={(sections.data ?? [])
                    .filter(
                      (s) =>
                        (!defaultTarget.programId || s.programId === defaultTarget.programId) &&
                        (!defaultTarget.semesterId || s.semesterId === defaultTarget.semesterId),
                    )
                    .map((s) => ({ value: s.id, label: s.name }))}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={!defaultTarget.programId || !defaultTarget.semesterId}
                onClick={applyDefaultsToAll}
              >
                Apply to all
              </Button>
            </div>

            <Separator />

            <ul className="divide-y">
              {(cohort.data?.data ?? [])
                .filter((en) => rows[en.id])
                .map((en) => {
                  const row = rows[en.id];
                  return (
                    <li key={en.id} className="flex flex-wrap items-end gap-3 py-3 text-sm">
                      <span className="w-48">
                        {en.student.firstName} {en.student.lastName}{" "}
                        <span className="text-muted-foreground">({en.student.studentCode})</span>
                      </span>
                      <div className="space-y-1">
                        <Label className="text-xs">Action</Label>
                        <NativeSelect
                          className="h-8 w-36"
                          placeholder="Select"
                          value={row.action}
                          onChange={(v) => updateRow(en.id, { action: v as PromotionAction })}
                          options={ACTION_OPTIONS}
                        />
                      </div>
                      {row.action !== "GRADUATE" ? (
                        <>
                          <div className="space-y-1">
                            <Label className="text-xs">Target program</Label>
                            <NativeSelect
                              className="h-8 w-36"
                              placeholder="Select"
                              value={row.targetProgramId}
                              onChange={(v) => updateRow(en.id, { targetProgramId: v, targetSectionId: "" })}
                              options={(programs.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Target semester</Label>
                            <NativeSelect
                              className="h-8 w-36"
                              placeholder="Select"
                              value={row.targetSemesterId}
                              onChange={(v) => updateRow(en.id, { targetSemesterId: v, targetSectionId: "" })}
                              options={(semesters.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Target section (optional)</Label>
                            <NativeSelect
                              className="h-8 w-32"
                              placeholder="None"
                              value={row.targetSectionId}
                              onChange={(v) => updateRow(en.id, { targetSectionId: v })}
                              options={(sections.data ?? [])
                                .filter(
                                  (s) =>
                                    (!row.targetProgramId || s.programId === row.targetProgramId) &&
                                    (!row.targetSemesterId || s.semesterId === row.targetSemesterId),
                                )
                                .map((s) => ({ value: s.id, label: s.name }))}
                            />
                          </div>
                        </>
                      ) : (
                        <span className="text-muted-foreground text-xs">No target needed — student graduates.</span>
                      )}
                    </li>
                  );
                })}
            </ul>

            <Button type="button" disabled={!canSubmit || submitting} onClick={submit}>
              {submitting ? "Applying…" : `Apply to ${rowList.length} student(s)`}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle>Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              {result.promoted} promoted, {result.retained} retained, {result.graduated} graduated.
            </p>
            {result.errors.length > 0 ? (
              <ul className="text-destructive list-disc space-y-1 pl-5">
                {result.errors.map((e, i) => (
                  <li key={i}>
                    Enrollment {e.enrollmentId}: {e.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
