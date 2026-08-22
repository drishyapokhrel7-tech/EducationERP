import { BrowserWindow, Menu, app, session } from "electron";
import { join } from "node:path";

// Not a forced-fullscreen kiosk like apps/exam-client — that choice
// there was specifically anti-cheat motivated. This is an ops-desk
// monitoring app (camera preview + event feed + review queue at
// once), where a resizable normal window serves the actual use better.
// Still locked down for the same underlying reason exam-client is:
// this process holds a long-lived admin session — no new windows, no
// navigating off-origin, devtools disabled once packaged.
export function createMainWindow(): BrowserWindow {
  Menu.setApplicationMenu(null);

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
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

  // Unlike exam-client's blanket deny, this app genuinely needs
  // camera access for its core purpose — allow only that, deny
  // everything else (microphone, geolocation, notifications, etc.).
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === "media");
  });

  return win;
}
