import { BrowserWindow, Menu, app, session } from "electron";
import { join } from "node:path";

// This app never makes a network call and never holds a session — its
// only I/O is a local file-open dialog — so there's no long-lived
// credential to protect. Still locked down the same way every other
// client in this family is (no external navigation, no new windows,
// devtools disabled once packaged) rather than inventing a laxer
// variant just because the stakes here are lower.
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

  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));

  return win;
}
