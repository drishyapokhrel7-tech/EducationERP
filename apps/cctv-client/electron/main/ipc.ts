import { BrowserWindow, ipcMain } from "electron";
import type { CreateCameraInput, LoginInput, ReviewFaceMatchInput } from "@education-erp/api-client";
import { apiClient, getRefreshToken, loadPersistedRefreshToken, setAccessToken, setRefreshToken } from "./apiClient";
import { RefreshScheduler } from "./refreshScheduler";

export interface CapturedFrame {
  buffer: ArrayBuffer;
  filename: string;
  mimeType: string;
}

// One narrow, explicitly-allowlisted handler per channel the preload
// script exposes — same convention as apps/exam-client. The renderer
// never gets raw Node/ipcRenderer access, and every write this app
// makes goes through the existing services/api endpoints (6a-6d) —
// nothing here reimplements business logic.
export function registerIpcHandlers(_win: BrowserWindow): void {
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

  ipcMain.handle("cameras:list", () => apiClient.listCameras());

  ipcMain.handle("cameras:register", (_event, input: CreateCameraInput) => apiClient.createCamera(input));

  ipcMain.handle("capture:submitFrame", (_event, cameraId: string, frame: CapturedFrame) => {
    // Only the renderer has getUserMedia/canvas — it captures the
    // frame and sends the raw bytes across IPC (structured-clone-safe
    // as an ArrayBuffer); reconstructed into a real File here so the
    // exact same api-client method a manual web-dashboard upload uses
    // (ingestCameraEvent) handles it identically.
    const file = new File([new Uint8Array(frame.buffer)], frame.filename, { type: frame.mimeType });
    return apiClient.ingestCameraEvent(cameraId, file);
  });

  ipcMain.handle("events:listRecent", () => apiClient.listFaceMatchEvents());

  ipcMain.handle("events:review", (_event, id: string, input: ReviewFaceMatchInput) =>
    apiClient.reviewFaceMatch(id, input),
  );

  ipcMain.handle("events:getImage", async (_event, id: string) => {
    const blob = await apiClient.getFaceMatchImage(id);
    return { buffer: await blob.arrayBuffer(), mimeType: blob.type };
  });
}
