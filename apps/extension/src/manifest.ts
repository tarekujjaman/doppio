/**
 * MV3 manifest (MVP-12/13) — consumed by CRXJS in M8.
 * permissions: tabCapture, offscreen, storage, sidePanel
 * host_permissions: ${APP_URL}/*
 */
export const manifest = {
  manifest_version: 3,
  name: "Doppio — capture browser meetings",
  version: "0.0.1",
  description: "Quick on/off capture of browser-tab audio into your Doppio memory.",
  permissions: ["tabCapture", "offscreen", "storage", "sidePanel"],
  host_permissions: ["http://localhost:3000/*"],
  background: { service_worker: "src/background/index.ts", type: "module" },
  side_panel: { default_path: "src/sidepanel/index.html" },
  action: { default_title: "Doppio" },
} as const;
