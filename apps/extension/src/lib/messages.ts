/** Runtime messages between the side panel, service worker, and offscreen doc. */
export type Message =
  // side panel → service worker
  | { type: "START_CAPTURE"; token: string }
  | { type: "STOP_CAPTURE"; token: string } // fresh token for the upload
  // service worker → offscreen
  | { type: "OFFSCREEN_START"; streamId: string; token: string; appUrl: string; title: string }
  | { type: "OFFSCREEN_STOP"; token: string }
  // offscreen → everyone (broadcast)
  | { type: "CAPTURE_STARTED" }
  | { type: "CAPTURE_STOPPED" } // recording ended, upload starting
  | { type: "CAPTURE_UPLOADED"; sessionId: string }
  | { type: "CAPTURE_ERROR"; message: string };

export const OFFSCREEN_PATH = "offscreen.html";
