import { app } from "electron";
import { join } from "node:path";
import { createMainWindow } from "./window";
import { registerIpcHandlers } from "./ipc";

app.whenReady().then(() => {
  const win = createMainWindow();
  registerIpcHandlers(win);

  win.webContents.on("did-finish-load", () => console.log("[exam-client] window loaded"));
  win.webContents.on("did-fail-load", (_e, code, description) =>
    console.error(`[exam-client] window failed to load: ${code} ${description}`),
  );

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"));
  }
});

app.on("window-all-closed", () => {
  app.quit();
});
