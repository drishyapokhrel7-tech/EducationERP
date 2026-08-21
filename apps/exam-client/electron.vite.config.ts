import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    // @education-erp/api-client ships raw TypeScript with no build step
    // (its package.json "main" points straight at src/index.ts) — fine
    // for bundler-based consumers (apps/web, ts-jest) that transpile it,
    // but Node's built-in strip-only TS loader can't handle real TS
    // syntax like ApiError's constructor parameter properties, only
    // erasable type annotations. Excluding it here so electron-vite
    // actually bundles/transpiles it into plain JS instead of leaving a
    // runtime `require` of the raw .ts file for Electron's Node to choke
    // on.
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
