import { BrowserWindow, ipcMain } from "electron";
import type { BindGatewayCardInput, GatewayScanInput, LoginInput, RegisterGatewayDeviceInput } from "@education-erp/api-client";
import { apiClient, getRefreshToken, loadPersistedRefreshToken, setAccessToken, setRefreshToken } from "./apiClient";
import { RefreshScheduler } from "./refreshScheduler";
import { fingerprintAdapter } from "./fingerprintAdapter";

// One narrow, explicitly-allowlisted handler per channel the preload
// script exposes — same convention as apps/exam-client/apps/cctv-client.
// The renderer never gets raw Node/ipcRenderer access, and every write
// this app makes goes through the existing services/api endpoints —
// nothing here reimplements business logic.
export function registerIpcHandlers(win: BrowserWindow): void {
  const scheduler = new RefreshScheduler();

  ipcMain.handle("auth:tryResume", async () => {
    const token = loadPersistedRefreshToken();
    if (!token) return false;
    setRefreshToken(token);
    return scheduler.refreshNow();
  });

  ipcMain.handle("auth:captcha", async () => apiClient.getCaptcha());

  ipcMain.handle("auth:login", async (_event, input: LoginInput) => {
    const result = await apiClient.login(input);
    setAccessToken(result.accessToken);
    setRefreshToken(result.refreshToken);
    scheduler.scheduleFrom(result.expiresIn);
    return result.user;
  });

  ipcMain.handle("auth:logout", async () => {
    scheduler.clear();
    const token = getRefreshToken();
    setAccessToken(null);
    setRefreshToken(null);
    if (token) {
      // Best-effort — logout proceeds locally regardless of whether
      // the server-side revoke succeeds.
      await apiClient.logout(token).catch(() => undefined);
    }
  });

  ipcMain.handle("devices:list", () => apiClient.listGatewayDevices());

  ipcMain.handle("devices:register", (_event, input: RegisterGatewayDeviceInput) =>
    apiClient.registerGatewayDevice(input),
  );

  ipcMain.handle("gateway:scan", (_event, deviceId: string, input: GatewayScanInput) =>
    apiClient.scanGatewayDevice(deviceId, input),
  );

  ipcMain.handle("gateway:bind", (_event, input: BindGatewayCardInput) => apiClient.bindGatewayCard(input));

  ipcMain.handle("events:listRecent", () => apiClient.listGatewayScanEvents());

  // The "who does this belong to?" bind flow's person pickers — reuses
  // the same already-built, already-sorted /students/picker and
  // /employees/picker endpoints every other "pick a person" UI in this
  // project uses, not a new lookup.
  ipcMain.handle("pickers:students", () => apiClient.listStudentsPicker());
  ipcMain.handle("pickers:employees", () => apiClient.listEmployeesPicker());

  // Fingerprint capture — see fingerprintAdapter.ts for why this is a
  // wired, disclosed no-op today rather than a real hardware call.
  ipcMain.handle("gateway:fingerprintCapture", () => fingerprintAdapter.capture());

  // Prints a small, purpose-built badge — not the app's own window
  // (which would print the whole station UI). A short-lived, offscreen
  // BrowserWindow loads just the badge HTML the renderer built, prints
  // it via Electron's own cross-vendor print dialog (no vendor SDK,
  // matching the plan's own "must not hard-code a vendor" requirement
  // for the one device type Electron already has a first-class API
  // for), then is destroyed once the dialog closes.
  ipcMain.handle("gateway:print", async (_event, html: string) => {
    const printWin = new BrowserWindow({
      show: false,
      parent: win,
      webPreferences: { sandbox: true, contextIsolation: true },
    });
    try {
      await printWin.loadURL(`data:text/html,${encodeURIComponent(html)}`);
      // webContents.print() is callback-based in this Electron version
      // (no Promise overload on BrowserWindow's webContents, unlike the
      // <webview> tag's own print()) — wrapped so the handler still
      // resolves only once the OS print dialog has actually closed.
      await new Promise<void>((resolve, reject) => {
        printWin.webContents.print({ silent: false }, (success, failureReason) => {
          if (success) resolve();
          else reject(new Error(failureReason || "Print cancelled"));
        });
      });
    } finally {
      if (!printWin.isDestroyed()) printWin.destroy();
    }
  });
}
