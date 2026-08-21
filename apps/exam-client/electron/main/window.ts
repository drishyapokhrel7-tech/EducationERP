import { BrowserWindow, Menu, app, session } from "electron";
import { join } from "node:path";

// Soft kiosk lockdown, deliberately not deep OS-level enforcement (the
// scope decision behind this slice): Electron's own kiosk/fullscreen
// APIs, no window chrome, devtools disabled once packaged, no menu bar,
// no way to open a second window or navigate away from the app's own
// renderer. before-input-event can only intercept a shortcut while this
// window has OS focus — it cannot stop the OS itself from switching
// focus away (that would need native, per-OS modules, out of scope
// here) — that's the documented boundary of "soft" lockdown.
const BLOCKED_ACCELERATORS = new Set(["F11", "F12"]);

export function createMainWindow(): BrowserWindow {
  Menu.setApplicationMenu(null);

  const win = new BrowserWindow({
    kiosk: true,
    fullscreen: true,
    frame: false,
    resizable: false,
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
    if (BLOCKED_ACCELERATORS.has(input.key)) {
      event.preventDefault();
      return;
    }
    const isDevToolsShortcut =
      input.control && input.shift && (input.key === "I" || input.key === "i");
    if (isDevToolsShortcut && app.isPackaged) {
      event.preventDefault();
    }
  });

  // No new windows, and no navigating away from the app's own renderer —
  // a locked exam view shouldn't be able to end up anywhere else. Denying
  // outright (not opening the URL externally either) — popping a real
  // system browser open would itself be an escape hatch from the kiosk.
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    const currentUrl = win.webContents.getURL();
    if (!currentUrl) return; // initial load, nothing to compare against yet
    if (new URL(url).origin !== new URL(currentUrl).origin) {
      event.preventDefault();
    }
  });

  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));

  return win;
}
