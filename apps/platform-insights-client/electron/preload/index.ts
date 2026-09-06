import { contextBridge, ipcRenderer } from "electron";
import type { PlatformInsightsApi } from "./types";

const platformInsights: PlatformInsightsApi = {
  openSnapshot: () => ipcRenderer.invoke("snapshot:open"),
  openLatestSnapshot: () => ipcRenderer.invoke("snapshot:openLatest"),
};

contextBridge.exposeInMainWorld("platformInsights", platformInsights);
