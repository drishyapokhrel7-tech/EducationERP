"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { downloadBlob } from "@/lib/download";
import type { CombinedImportResult, ImportResult } from "@education-erp/api-client";

const SHEETS: { key: keyof CombinedImportResult; label: string }[] = [
  { key: "students", label: "Students" },
  { key: "employees", label: "Employees" },
  { key: "activities", label: "Extra-curricular Activities" },
  { key: "disciplineIncidents", label: "Discipline Incidents" },
  { key: "healthVisits", label: "Health Visits" },
];

function ResultRow({ label, result }: { label: string; result: ImportResult }) {
  return (
    <div className="space-y-1 rounded-md border p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {result.created} created, {result.updated} updated (of {result.totalRows} row{result.totalRows === 1 ? "" : "s"})
        </span>
      </div>
      {result.errors.length > 0 ? (
        <ul className="list-inside list-disc text-destructive">
          {result.errors.map((e, i) => (
            <li key={i}>
              Row {e.row}: {e.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// One workbook covering every entity that already has its own Excel
// round trip (Students, Employees, Extracurricular Activities,
// Discipline Incidents, Health Visits) as separate sheets, so an org
// can bulk-load or re-sync several kinds of records from a single file
// instead of visiting five separate pages. Students and Employees have
// no dependency on anything else in the file; Activities/Incidents/
// Health Visits resolve their row's student by studentCode, including
// one a Students sheet in the same file just created — the backend
// processes sheets in that dependency order.
export default function DataSyncPage() {
  const importFileRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<CombinedImportResult | null>(null);
  const [importing, setImporting] = useState(false);

  async function handleImport() {
    const file = importFileRef.current?.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const result = await api.importDataSync(file);
      setImportResult(result);
      if (importFileRef.current) importFileRef.current.value = "";
      const totals = Object.values(result).reduce(
        (acc, r) => ({ created: acc.created + r.created, updated: acc.updated + r.updated }),
        { created: 0, updated: 0 },
      );
      toast.success(`${totals.created} created, ${totals.updated} updated across ${Object.keys(result).length} sheet(s)`);
    } catch {
      toast.error("Import failed — check the file is the data sync workbook, unedited beyond its own sheets");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Data Sync</h1>
        <p className="text-muted-foreground text-sm">
          One Excel workbook covering Students, Employees, Extra-curricular Activities, Discipline Incidents, and Health
          Visits — download it, fill in or edit any of its sheets, and re-upload to sync every change back at once.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Download</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => downloadBlob(() => api.downloadDataSyncTemplate(), "erp-data-sync-template.xlsx")}
          >
            Blank template
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => downloadBlob(() => api.exportDataSyncEditable(), "erp-data-sync-editable.xlsx")}
          >
            Current data (editable)
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload &amp; sync</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <input ref={importFileRef} type="file" accept=".xlsx" className="text-sm" disabled={importing} />
            <Button type="button" disabled={importing} onClick={handleImport}>
              {importing ? "Syncing…" : "Sync"}
            </Button>
          </div>
          {importResult ? (
            <div className="space-y-2">
              {SHEETS.map(({ key, label }) => {
                const result = importResult[key];
                return result ? <ResultRow key={key} label={label} result={result} /> : null;
              })}
              {Object.keys(importResult).length < SHEETS.length ? (
                <p className="text-muted-foreground text-xs">
                  Sheets not shown above weren&apos;t present in the uploaded file — they were skipped, not synced empty.
                </p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-xs">
        <Badge variant="outline" className="mr-1">
          Tip
        </Badge>
        Leave a sheet blank (or delete it) to skip that entity entirely — only sheets actually present in the file are
        processed.
      </p>
    </div>
  );
}
