"use client";

import { useRef, useState } from "react";
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
import type { DisciplineSeverity, IncidentTypeRecord, ImportResult } from "@education-erp/api-client";

const SEVERITY_OPTIONS: { value: DisciplineSeverity; label: string }[] = [
  { value: "MINOR", label: "Minor" },
  { value: "MODERATE", label: "Moderate" },
  { value: "MAJOR", label: "Major" },
];

function severityVariant(severity: DisciplineSeverity): "default" | "warning" | "destructive" {
  if (severity === "MAJOR") return "destructive";
  if (severity === "MODERATE") return "warning";
  return "default";
}

// Sources its options from the org's own DisciplineIncidentType catalog
// and lets the picker add a new standard value inline — mirrors
// dashboard/hostel/page.tsx's LookupSelect, just without a `kind`
// discriminator since this catalog only has one category.
function IncidentTypeSelect({
  value,
  onChange,
  options,
  onCreated,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  onCreated: () => void;
  className?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [newValue, setNewValue] = useState("");

  if (adding) {
    return (
      <div className="flex items-end gap-1">
        <div className="space-y-1">
          <Label className="text-xs">New incident type</Label>
          <Input className={className ?? "w-36"} value={newValue} onChange={(e) => setNewValue(e.target.value)} autoFocus />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!newValue.trim()}
          onClick={() =>
            submitAction(
              () => api.createIncidentType({ name: newValue.trim() }),
              () => {
                onChange(newValue.trim());
                setNewValue("");
                setAdding(false);
                onCreated();
              },
            )
          }
        >
          Add
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <NativeSelect
      className={className}
      placeholder="Select incident type"
      value={value}
      onChange={(v) => (v === "__add_new__" ? setAdding(true) : onChange(v))}
      options={[...options.map((o) => ({ value: o, label: o })), { value: "__add_new__", label: "+ Add new…" }]}
    />
  );
}

function IncidentTypeManageList({ data, mutate }: { data: IncidentTypeRecord[] | undefined; mutate: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "" });

  return (
    <div className="space-y-2">
      {!data || data.length === 0 ? (
        <p className="text-muted-foreground text-xs">None yet.</p>
      ) : (
        <ul className="divide-y text-sm">
          {data.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 py-2">
              <span>{t.name}</span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingId(t.id);
                    setEditForm({ name: t.name });
                  }}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => submitDelete(() => api.deleteIncidentType(t.id), () => mutate())}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editingId ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submitAction(() => api.updateIncidentType(editingId, editForm), () => {
              setEditingId(null);
              mutate();
            });
          }}
        >
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input className="h-7 w-40" value={editForm.name} onChange={(e) => setEditForm({ name: e.target.value })} />
          </div>
          <Button type="submit" size="sm" className="h-7" disabled={!editForm.name}>
            Save
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => setEditingId(null)}>
            Cancel
          </Button>
        </form>
      ) : null}
    </div>
  );
}

export default function DisciplinePage() {
  const studentsPicker = useSWR("students-picker", () => api.listStudentsPicker());
  const incidentTypes = useSWR("discipline-incident-types", () => api.listIncidentTypes());

  const [page, setPage] = useState(1);
  const [studentFilter, setStudentFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const incidents = useSWR(["discipline-incidents", page, studentFilter, severityFilter], () =>
    api.listAllIncidents({
      page,
      studentId: studentFilter || undefined,
      severity: (severityFilter || undefined) as DisciplineSeverity | undefined,
    }),
  );

  const [form, setForm] = useState({
    studentId: "",
    incidentType: "",
    severity: "" as DisciplineSeverity | "",
    description: "",
    actionTaken: "",
    incidentDate: "",
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    incidentType: "",
    severity: "" as DisciplineSeverity | "",
    description: "",
    actionTaken: "",
    incidentDate: "",
  });

  const importFileRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);

  async function handleImport() {
    const file = importFileRef.current?.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const result = await api.importIncidents(file);
      setImportResult(result);
      incidents.mutate();
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
        <h1 className="text-2xl font-bold">Discipline &amp; Behavior</h1>
        <p className="text-muted-foreground text-sm">
          Incident type is an admin-configurable catalog, not free text — pick from the list or add a new standard
          value inline.
        </p>
      </div>

      <EntityCard
        id="discipline-incidents"
        title="Incidents"
        emptyLabel="No incidents match these filters."
        items={incidents.data?.data}
        footer={
          <>
            {incidents.data ? (
              <ListPager
                page={incidents.data.page}
                totalPages={incidents.data.totalPages}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => p + 1)}
              />
            ) : null}
            {editingId ? (
              <form
                className="flex flex-wrap items-end gap-3 border-b pb-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitAction(
                    () =>
                      api.updateIncident(editingId, {
                        incidentType: editForm.incidentType,
                        severity: editForm.severity as DisciplineSeverity,
                        description: editForm.description,
                        actionTaken: editForm.actionTaken || undefined,
                        incidentDate: editForm.incidentDate,
                      }),
                    () => {
                      setEditingId(null);
                      incidents.mutate();
                    },
                  );
                }}
              >
                <div className="space-y-2">
                  <Label>Incident type</Label>
                  <IncidentTypeSelect
                    className="w-40"
                    value={editForm.incidentType}
                    onChange={(v) => setEditForm((f) => ({ ...f, incidentType: v }))}
                    options={(incidentTypes.data ?? []).map((t) => t.name)}
                    onCreated={() => incidentTypes.mutate()}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Severity</Label>
                  <NativeSelect
                    className="w-32"
                    placeholder="Select"
                    value={editForm.severity}
                    onChange={(v) => setEditForm((f) => ({ ...f, severity: v as DisciplineSeverity }))}
                    options={SEVERITY_OPTIONS}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Incident date</Label>
                  <Input
                    required
                    type="date"
                    value={editForm.incidentDate}
                    onChange={(e) => setEditForm((f) => ({ ...f, incidentDate: e.target.value }))}
                  />
                </div>
                <div className="w-full space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <div className="w-full space-y-2">
                  <Label>Action taken (optional)</Label>
                  <Textarea
                    value={editForm.actionTaken}
                    onChange={(e) => setEditForm((f) => ({ ...f, actionTaken: e.target.value }))}
                  />
                </div>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!editForm.incidentType || !editForm.severity || !editForm.description || !editForm.incidentDate}
                >
                  Save
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(null)}>
                  Cancel
                </Button>
              </form>
            ) : null}
          </>
        }
        renderItem={(i: {
          id: string;
          incidentType: string;
          severity: DisciplineSeverity;
          description: string;
          actionTaken: string | null;
          incidentDate: string;
          reportedBy: { firstName: string; lastName: string };
          student: { firstName: string; lastName: string; studentCode: string };
        }) => (
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <span>
                {i.student.firstName} {i.student.lastName}{" "}
                <span className="text-muted-foreground">({i.student.studentCode})</span> — {i.incidentType}{" "}
                <Badge variant={severityVariant(i.severity)}>{i.severity}</Badge> ·{" "}
                {new Date(i.incidentDate).toLocaleDateString()}
              </span>
              <p className="text-muted-foreground text-xs">{i.description}</p>
              {i.actionTaken ? <p className="text-muted-foreground text-xs">Action: {i.actionTaken}</p> : null}
              <p className="text-muted-foreground text-xs">
                Reported by {i.reportedBy.firstName} {i.reportedBy.lastName}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingId(i.id);
                  setEditForm({
                    incidentType: i.incidentType,
                    severity: i.severity,
                    description: i.description,
                    actionTaken: i.actionTaken ?? "",
                    incidentDate: i.incidentDate.slice(0, 10),
                  });
                }}
              >
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => submitDelete(() => api.deleteIncident(i.id), () => incidents.mutate())}
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
            onClick={() => downloadBlob(() => api.downloadIncidentImportTemplate(), "discipline-incidents-import-template.xlsx")}
          >
            Download template
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => downloadBlob(() => api.exportIncidentsEditable(), "discipline-incidents-editable.xlsx")}
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
              value={studentFilter}
              onChange={(v) => {
                setStudentFilter(v);
                setPage(1);
              }}
              options={(studentsPicker.data ?? []).map(studentToPersonOption)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Filter by severity</Label>
            <NativeSelect
              className="h-8 w-32"
              placeholder="All severities"
              value={severityFilter}
              onChange={(v) => {
                setSeverityFilter(v);
                setPage(1);
              }}
              options={SEVERITY_OPTIONS}
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
                api.createStudentIncident(form.studentId, {
                  incidentType: form.incidentType,
                  severity: form.severity as DisciplineSeverity,
                  description: form.description,
                  actionTaken: form.actionTaken || undefined,
                  incidentDate: form.incidentDate,
                }),
              () => {
                setForm((f) => ({
                  ...f,
                  incidentType: "",
                  severity: "",
                  description: "",
                  actionTaken: "",
                  incidentDate: "",
                }));
                incidents.mutate();
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label>Student</Label>
            <PersonPicker
              className="w-56"
              placeholder="Select student"
              value={form.studentId}
              onChange={(v) => setForm((f) => ({ ...f, studentId: v }))}
              options={(studentsPicker.data ?? []).map(studentToPersonOption)}
            />
          </div>
          <div className="space-y-2">
            <Label>Incident type</Label>
            <IncidentTypeSelect
              className="w-40"
              value={form.incidentType}
              onChange={(v) => setForm((f) => ({ ...f, incidentType: v }))}
              options={(incidentTypes.data ?? []).map((t) => t.name)}
              onCreated={() => incidentTypes.mutate()}
            />
          </div>
          <div className="space-y-2">
            <Label>Severity</Label>
            <NativeSelect
              className="w-32"
              placeholder="Select"
              value={form.severity}
              onChange={(v) => setForm((f) => ({ ...f, severity: v as DisciplineSeverity }))}
              options={SEVERITY_OPTIONS}
            />
          </div>
          <div className="space-y-2">
            <Label>Incident date</Label>
            <Input
              required
              type="date"
              value={form.incidentDate}
              onChange={(e) => setForm((f) => ({ ...f, incidentDate: e.target.value }))}
            />
          </div>
          <div className="w-full space-y-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="w-full space-y-2">
            <Label>Action taken (optional)</Label>
            <Textarea value={form.actionTaken} onChange={(e) => setForm((f) => ({ ...f, actionTaken: e.target.value }))} />
          </div>
          <Button
            type="submit"
            disabled={!form.studentId || !form.incidentType || !form.severity || !form.description || !form.incidentDate}
          >
            Add
          </Button>
        </form>
      </EntityCard>

      <Card>
        <CardHeader>
          <CardTitle>Incident Types</CardTitle>
        </CardHeader>
        <CardContent>
          <IncidentTypeManageList data={incidentTypes.data} mutate={() => incidentTypes.mutate()} />
        </CardContent>
      </Card>
    </div>
  );
}
