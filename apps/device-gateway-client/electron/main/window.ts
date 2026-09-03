import { BrowserWindow, Menu, app, session } from "electron";
import { join } from "node:path";

// Not a forced-fullscreen kiosk like apps/exam-client (anti-cheat
// motivated there) — this is an ops/front-desk scan-in station, same
// "resizable normal window serves the actual use better" call as
// apps/cctv-client. Unlike cctv-client, this app needs no OS media
// permission at all (scan input is a plain keyboard/HID device, print
// goes through Electron's own print dialog) — so the permission
// handler below denies everything, matching exam-client's blanket
// deny rather than cctv-client's media-only allow. Still locked down
// for the same underlying reason both other clients are: a long-lived
// admin session — no new windows, no navigating off-origin, devtools
// disabled once packaged.
export function createMainWindow(): BrowserWindow {
  Menu.setApplicationMenu(null);

  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
    },
  });

  win.webContents.on("before-input-event", (event, input) => {
    const isDevToolsShortcut = input.control && input.shift && (input.key === "I" || input.key === "i");
    if (isDevToolsShortcut && app.isPackaged) {
      event.preventDefault();
    }
  });

  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    const currentUrl = win.webContents.getURL();
    if (!currentUrl) return; // initial load, nothing to compare against yet
    if (new URL(url).origin !== new URL(currentUrl).origin) {
      event.preventDefault();
    }
  });

  // Explicit blanket deny, matching exam-client — Electron's default
  // (no handler registered at all) is to *grant* every permission
  // request, which would be the wrong default for a long-lived admin
  // session on a kiosk machine.
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));

  return win;
}
