import { BrowserWindow, dialog, ipcMain } from "electron";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { InsightsSnapshot } from "../preload/types";

function parseSnapshot(raw: string): InsightsSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("organizations" in parsed) ||
    !Array.isArray((parsed as { organizations: unknown }).organizations)
  ) {
    throw new Error("That file doesn't look like an Insights snapshot (missing an \"organizations\" array).");
  }
  // `leads` postdates this field's introduction — default to empty so
  // a snapshot exported by an older version of the export script (no
  // `leads` array at all) still opens instead of the renderer
  // crashing on a missing property.
  const snapshot = parsed as InsightsSnapshot;
  if (!Array.isArray(snapshot.leads)) snapshot.leads = [];
  return snapshot;
}

// Where `pnpm run insights:export` might have left a file: the
// directory it was explicitly pointed at (--out), its own default
// (services/api's own cwd, since the script's default is
// `./insights-snapshot-<ISO-date>.json`), and the OS temp dir (a
// common ad-hoc --out target). Not configurable beyond this — this
// is a local dev convenience, not a product feature.
function candidateDirs(): string[] {
  const apiDir = join(__dirname, "../../../../services/api");
  // os.tmpdir() (Node/Electron's own per-process temp dir, e.g.
  // /var/folders/.../T on macOS) and the plain "/tmp" a shell command
  // means by that name are frequently two different directories on
  // macOS — check both rather than assuming they coincide.
  return [tmpdir(), "/tmp", apiDir];
}

// Newest-by-mtime file matching the export script's own naming
// convention across every candidate directory — "latest" is
// whichever one was written most recently, regardless of which
// directory it landed in.
function findLatestSnapshotPath(): string | null {
  let best: { path: string; mtimeMs: number } | null = null;
  for (const dir of candidateDirs()) {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (!/insights-snapshot.*\.json$/i.test(name)) continue;
      const path = join(dir, name);
      let mtimeMs: number;
      try {
        mtimeMs = statSync(path).mtimeMs;
      } catch {
        continue;
      }
      if (!best || mtimeMs > best.mtimeMs) best = { path, mtimeMs };
    }
  }
  return best?.path ?? null;
}

// Two narrow, explicitly-allowlisted handlers — the same convention
// as every other client in this family, just with a single channel
// (plus this auto-discovery variant) since this app performs no
// network I/O at all.
export function registerIpcHandlers(win: BrowserWindow): void {
  ipcMain.handle("snapshot:open", async (): Promise<InsightsSnapshot | null> => {
    const result = await dialog.showOpenDialog(win, {
      title: "Open an Insights snapshot",
      filters: [{ name: "Insights snapshot", extensions: ["json"] }],
      properties: ["openFile"],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return parseSnapshot(readFileSync(result.filePaths[0], "utf-8"));
  });

  // No dialog — silently returns null if nothing is found, so the
  // caller (App.tsx, on startup) can fall back to the manual picker
  // without surfacing an error for the common case of a fresh
  // checkout with no snapshot exported yet.
  ipcMain.handle("snapshot:openLatest", async (): Promise<InsightsSnapshot | null> => {
    const path = findLatestSnapshotPath();
    if (!path) return null;
    return parseSnapshot(readFileSync(path, "utf-8"));
  });
}
