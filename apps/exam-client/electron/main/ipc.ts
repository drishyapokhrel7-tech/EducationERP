import { BrowserWindow, ipcMain } from "electron";
import type { LoginInput, SaveAnswerInput } from "@education-erp/api-client";
import { apiClient, setAccessToken } from "./apiClient";
import { AnswerSyncQueue, retryWithBackoff, type SyncStatus } from "./retryQueue";

// One narrow, explicitly-allowlisted handler per channel the preload
// script exposes — nothing else is reachable from the renderer. The
// exam-taking business logic (shuffle, scoring, window enforcement)
// already lives server-side in services/api/src/modules/exam-taking;
// every handler here is a thin pass-through plus, for the two
// autosave/submit calls, the retry-queue wrapper.
export function registerIpcHandlers(win: BrowserWindow): void {
  const answerQueue = new AnswerSyncQueue();
  let refreshToken: string | null = null;

  function sendStatus(kind: "answer" | "submit", status: SyncStatus, questionId?: string) {
    win.webContents.send("sync:status", { kind, status, questionId });
  }

  ipcMain.handle("auth:captcha", async () => apiClient.getCaptcha());

  ipcMain.handle("auth:login", async (_event, input: LoginInput) => {
    const result = await apiClient.login(input);
    setAccessToken(result.accessToken);
    refreshToken = result.refreshToken;
    return result.user;
  });

  ipcMain.handle("auth:logout", async () => {
    const token = refreshToken;
    setAccessToken(null);
    refreshToken = null;
    if (token) {
      // Best-effort — the caller is logging out regardless of whether
      // the server-side revoke succeeds.
      await apiClient.logout(token).catch(() => undefined);
    }
  });

  ipcMain.handle("exams:list", () => apiClient.listMyExams());

  ipcMain.handle("exams:start", (_event, examSubjectId: string) => apiClient.startMyExam(examSubjectId));

  ipcMain.handle(
    "exams:saveAnswer",
    (_event, examSubjectId: string, questionId: string, input: SaveAnswerInput) =>
      answerQueue.send(
        questionId,
        () => apiClient.saveMyAnswer(examSubjectId, questionId, input),
        (status) => sendStatus("answer", status, questionId),
      ),
  );

  ipcMain.handle("exams:submit", (_event, examSubjectId: string) =>
    retryWithBackoff(
      () => apiClient.submitMyExam(examSubjectId),
      (status) => sendStatus("submit", status),
    ),
  );
}
