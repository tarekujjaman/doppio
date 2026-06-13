/** Runtime messages between the side panel, service worker, and offscreen doc. */
export type Message =
  // side panel → service worker
  | { type: "STOP_CAPTURE" } // panel Stop button
  | { type: "QUERY_STATE" } // panel → offscreen: rehydrate on (re)open
  | { type: "RETRY_UPLOAD" } // panel → offscreen: retry a failed upload
  | { type: "DOWNLOAD_RECORDING" } // panel → offscreen: save the blob locally
  // service worker → offscreen
  | { type: "OFFSCREEN_START"; streamId: string; appUrl: string; title: string }
  | { type: "OFFSCREEN_STOP" }
  // → side panel (broadcast)
  | { type: "CAPTURE_STARTED" }
  | { type: "CAPTURE_TICK" } // keepalive ping so Chrome doesn't suspend the SW mid-record
  | { type: "CAPTURE_STOPPED" } // recording ended, upload starting
  | { type: "CAPTURE_UPLOADED"; sessionId: string }
  | { type: "CAPTURE_ERROR"; message: string; recoverable?: boolean }
  | { type: "NEEDS_SIGNIN" } // icon clicked while signed out
  // offscreen → panel (query response)
  | { type: "CAPTURE_STATE"; recording: boolean; elapsedMs: number };

export const OFFSCREEN_PATH = "offscreen.html";
export const CAPTURING_FLAG = "doppio_capturing";
