// Mirrors the shape written by services/api/prisma/export-insights-snapshot.ts.
// Plain types only (no `electron` import, no runtime code) — same
// reasoning as every other client's own preload/types.ts, so this stays
// importable from the renderer without pulling contextBridge code into
// its bundle.

export const MODULE_KEYS = [
  "admissions",
  "timetable",
  "attendance",
  "syllabus",
  "assignments",
  "knowledgeChecks",
  "exams",
  "finance",
  "leave",
  "payroll",
  "transport",
  "hostel",
  "inventory",
  "communication",
  "certificates",
  "alumni",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export type Edition = "FREE" | "PROFESSIONAL" | "ULTRA";

export interface OrgSnapshotEntry {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  edition: Edition;
  editionExpiresAt: string | null;
  studentCount: number;
  employeeCount: number;
  moduleUsage: Record<ModuleKey, number>;
}

export interface InsightsSnapshot {
  generatedAt: string;
  organizations: OrgSnapshotEntry[];
}

// The single narrow, explicitly-allowlisted IPC surface exposed on
// window.platformInsights — nothing else reaches the renderer. This
// app never talks to the network; opening a local snapshot file is
// its only I/O.
export interface PlatformInsightsApi {
  openSnapshot: () => Promise<InsightsSnapshot | null>;
}
