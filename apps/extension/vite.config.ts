import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

// Plain multi-entry MV3 build (no CRXJS, for predictable output paths):
//  - index.html      → side panel
//  - offscreen.html  → offscreen document (tab-audio capture + upload)
//  - service-worker  → background service worker (stable name for the manifest)
// public/manifest.json is copied to dist/ verbatim.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "esnext",
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        offscreen: resolve(__dirname, "offscreen.html"),
        "service-worker": resolve(__dirname, "src/background/service-worker.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
