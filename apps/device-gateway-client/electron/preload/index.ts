import { contextBridge, ipcRenderer } from "electron";
import type { DeviceGatewayClientApi } from "./types";

// Implementation of the DeviceGatewayClientApi surface declared in
// ./types. Kept as one self-contained file rather than split into a
// shared packages/electron-shared — considered twice already (slices
// 4g, 6e) and deferred both times ("the actual overlap turns out to
// be a handful of contextBridge lines... duplicating was the better
// call than a premature abstraction"); a third client follows the
// same precedent rather than revisiting it now.
const deviceGatewayClient: DeviceGatewayClientApi = {
  tryResume: () => ipcRenderer.invoke("auth:tryResume"),
  getCaptcha: () => ipcRenderer.invoke("auth:captcha"),
  login: (input) => ipcRenderer.invoke("auth:login", input),
  logout: () => ipcRenderer.invoke("auth:logout"),
  listDevices: () => ipcRenderer.invoke("devices:list"),
  registerDevice: (input) => ipcRenderer.invoke("devices:register", input),
  scan: (deviceId, input) => ipcRenderer.invoke("gateway:scan", deviceId, input),
  bindCard: (input) => ipcRenderer.invoke("gateway:bind", input),
  listRecentEvents: () => ipcRenderer.invoke("events:listRecent"),
  fingerprintCapture: () => ipcRenderer.invoke("gateway:fingerprintCapture"),
  print: (html) => ipcRenderer.invoke("gateway:print", html),
  listStudentsPicker: () => ipcRenderer.invoke("pickers:students"),
  listEmployeesPicker: () => ipcRenderer.invoke("pickers:employees"),
};

contextBridge.exposeInMainWorld("deviceGatewayClient", deviceGatewayClient);
