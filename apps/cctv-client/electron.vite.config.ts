import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    // Same @education-erp/api-client raw-.ts-shipping issue as
    // apps/exam-client — see that app's identical comment for the
    // full reasoning (Node's strip-only TS loader can't handle
    // ApiError's constructor parameter properties).
    plugins: [externalizeDepsPlugin({ exclude: ["@education-erp/api-client"] })],
    build: { rollupOptions: { input: resolve(__dirname, "electron/main/index.ts") } },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: resolve(__dirname, "electron/preload/index.ts") } },
  },
  renderer: {
    root: ".",
    build: { rollupOptions: { input: resolve(__dirname, "index.html") } },
    plugins: [react()],
  },
});
