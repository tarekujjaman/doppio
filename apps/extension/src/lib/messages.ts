/** Runtime messages between the side panel, service worker, and offscreen doc. */
export type Message =
  // side panel → service worker
  | { type: "START_CAPTURE"; token: string }
  | { type: "STOP_CAPTURE"; token: string } // fresh token for the upload
  | { type: "QUERY_STATE" } // panel → SW/offscreen: rehydrate on (re)open
  | { type: "RETRY_UPLOAD"; token: string } // panel → offscreen: retry a failed upload
  | { type: "DOWNLOAD_RECORDING" } // panel → offscreen: save the blob locally
  // service worker → offscreen
  | { type: "OFFSCREEN_START"; streamId: string; token: string; appUrl: string; title: string }
  | { type: "OFFSCREEN_STOP"; token: string }
  // offscreen → everyone (broadcast)
  | { type: "CAPTURE_STARTED" }
  | { type: "CAPTURE_TICK" } // keepalive ping so Chrome doesn't suspend the SW mid-record
  | { type: "CAPTURE_STOPPED" } // recording ended, upload starting
  | { type: "CAPTURE_UPLOADED"; sessionId: string }
  | { type: "CAPTURE_ERROR"; message: string; recoverable?: boolean }
  // offscreen → panel (query response)
  | { type: "CAPTURE_STATE"; recording: boolean; elapsedMs: number };

export const OFFSCREEN_PATH = "offscreen.html";
export const KEEPALIVE_ALARM = "doppio-capture-keepalive";
