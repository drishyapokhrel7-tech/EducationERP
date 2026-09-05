import { BrowserWindow, dialog, ipcMain } from "electron";
import { readFileSync } from "node:fs";
import type { InsightsSnapshot } from "../preload/types";

// One narrow, explicitly-allowlisted handler — the same convention as
// every other client in this family, just with a single channel since
// this app performs no network I/O at all.
export function registerIpcHandlers(win: BrowserWindow): void {
  ipcMain.handle("snapshot:open", async (): Promise<InsightsSnapshot | null> => {
    const result = await dialog.showOpenDialog(win, {
      title: "Open an Insights snapshot",
      filters: [{ name: "Insights snapshot", extensions: ["json"] }],
      properties: ["openFile"],
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    const raw = readFileSync(result.filePaths[0], "utf-8");
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
    return parsed as InsightsSnapshot;
  });
}
