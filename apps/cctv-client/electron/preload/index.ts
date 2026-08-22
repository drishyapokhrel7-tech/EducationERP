import { contextBridge, ipcRenderer } from "electron";
import type { CctvClientApi } from "./types";

// Implementation of the CctvClientApi surface declared in ./types.
// Kept as one self-contained file rather than split into a shared
// packages/electron-preload — the actual overlap with exam-client's
// preload turns out to be a handful of contextBridge lines while the
// substantive parts differ (see the plan's reasoning for slice 6e),
// so duplicating this small amount was the better call over a
// premature shared package.
const cctvClient: CctvClientApi = {
  tryResume: () => ipcRenderer.invoke("auth:tryResume"),
  login: (input) => ipcRenderer.invoke("auth:login", input),
  logout: () => ipcRenderer.invoke("auth:logout"),
  listCameras: () => ipcRenderer.invoke("cameras:list"),
  registerCamera: (input) => ipcRenderer.invoke("cameras:register", input),
  submitFrame: (cameraId, frame) => ipcRenderer.invoke("capture:submitFrame", cameraId, frame),
  listRecentEvents: () => ipcRenderer.invoke("events:listRecent"),
  reviewEvent: (id, input) => ipcRenderer.invoke("events:review", id, input),
  getEventImage: (id) => ipcRenderer.invoke("events:getImage", id),
};

contextBridge.exposeInMainWorld("cctvClient", cctvClient);
