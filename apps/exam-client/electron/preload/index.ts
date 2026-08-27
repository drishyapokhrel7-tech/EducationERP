import { contextBridge, ipcRenderer } from "electron";
import type { ExamClientApi, SyncStatusEvent } from "./types";

// Implementation of the ExamClientApi surface declared in ./types —
// exactly the six actions the app needs plus one status subscriber.
// Nothing else (no raw ipcRenderer, no Node globals) reaches the
// renderer. Kept as one self-contained file rather than split into a
// shared packages/electron-preload — see the plan's design section for
// why that abstraction is deferred until a second Electron client
// exists.
const examClient: ExamClientApi = {
  getCaptcha: () => ipcRenderer.invoke("auth:captcha"),
  login: (input) => ipcRenderer.invoke("auth:login", input),
  logout: () => ipcRenderer.invoke("auth:logout"),
  listExams: () => ipcRenderer.invoke("exams:list"),
  startExam: (examSubjectId) => ipcRenderer.invoke("exams:start", examSubjectId),
  saveAnswer: (examSubjectId, questionId, input) =>
    ipcRenderer.invoke("exams:saveAnswer", examSubjectId, questionId, input),
  submitExam: (examSubjectId) => ipcRenderer.invoke("exams:submit", examSubjectId),
  onSyncStatus: (callback: (event: SyncStatusEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: SyncStatusEvent) => callback(payload);
    ipcRenderer.on("sync:status", listener);
    return () => ipcRenderer.removeListener("sync:status", listener);
  },
};

contextBridge.exposeInMainWorld("examClient", examClient);
