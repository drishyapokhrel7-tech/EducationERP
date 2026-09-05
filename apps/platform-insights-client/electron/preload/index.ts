import { contextBridge, ipcRenderer } from "electron";
import type { PlatformInsightsApi } from "./types";

const platformInsights: PlatformInsightsApi = {
  openSnapshot: () => ipcRenderer.invoke("snapshot:open"),
};

contextBridge.exposeInMainWorld("platformInsights", platformInsights);
