/** Runtime messages between the side panel, service worker, and offscreen doc. */
export type Message =
  // side panel → service worker (token: offscreen can't read chrome.storage)
  | { type: "STOP_CAPTURE"; token: string } // panel Stop button
  | { type: "QUERY_STATE" } // panel → offscreen: rehydrate on (re)open
  | { type: "RETRY_UPLOAD"; token: string } // panel → offscreen: retry a failed upload
  | { type: "DOWNLOAD_RECORDING" } // panel → offscreen: save the blob locally
  | { type: "OFFSCREEN_PAUSE" } // panel → offscreen
  | { type: "OFFSCREEN_RESUME" } // panel → offscreen
  | { type: "OFFSCREEN_DISCARD" } // panel → offscreen: drop the recording, no upload
  // service worker → offscreen (token: fallback for tab-closed auto-stop)
  | { type: "OFFSCREEN_START"; streamId: string; appUrl: string; title: string; token: string }
  | { type: "OFFSCREEN_STOP"; token: string }
  // → side panel (broadcast)
  | { type: "CAPTURE_STARTED"; sessionId?: string }
  | { type: "CAPTURE_PAUSED" }
  | { type: "CAPTURE_RESUMED" }
  | { type: "CAPTURE_DISCARDED" }
  | { type: "CAPTURE_TICK" } // keepalive ping so Chrome doesn't suspend the SW mid-record
  | { type: "CAPTURE_STOPPED" } // recording ended, upload starting
  | { type: "CAPTURE_UPLOADED"; sessionId: string }
  | { type: "CAPTURE_ERROR"; message: string; recoverable?: boolean }
  | { type: "NEEDS_SIGNIN" } // icon clicked while signed out
  // offscreen → panel (query response)
  | { type: "CAPTURE_STATE"; recording: boolean; paused: boolean; elapsedMs: number; sessionId?: string };

export const OFFSCREEN_PATH = "offscreen.html";
export const CAPTURING_FLAG = "doppio_capturing";
