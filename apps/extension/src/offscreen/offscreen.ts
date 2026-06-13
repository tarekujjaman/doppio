import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, STORAGE_BUCKET } from "../lib/config";
import type { Message } from "../lib/messages";

// Storage-only client (signed uploads need no auth — the token authorizes).
const storage = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Auto-finalize before the server's 25MB cap so a long recording is saved
// (transcribed up to here) instead of rejected and lost.
const MAX_BYTES = 24 * 1024 * 1024;

interface CaptureCtx {
  token: string;
  appUrl: string;
  title: string;
}

let recorder: MediaRecorder | null = null;
let stream: MediaStream | null = null;
let audioCtx: AudioContext | null = null;
let chunks: Blob[] = [];
let bytes = 0;
let startedAt = 0;
let ctx: CaptureCtx | null = null;
// Holds a finished-but-not-yet-uploaded recording so a failed upload is retryable.
let pending: { blob: Blob; durationSec: number; capture: CaptureCtx } | null = null;

function broadcast(message: Message) {
  chrome.runtime.sendMessage(message).catch(() => {
    /* side panel may be closed — recording still completes */
  });
}

function friendly(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError") return "Tab capture was blocked.";
  if (err instanceof Error) return err.message;
  return String(err);
}

function cleanup() {
  recorder = null;
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  void audioCtx?.close().catch(() => undefined);
  audioCtx = null;
}

function pickMime(): string {
  for (const m of ["audio/webm;codecs=opus", "audio/webm"]) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "audio/webm";
}

async function start(streamId: string, capture: CaptureCtx) {
  // Never clobber an in-progress recording (double-click / duplicate START).
  if (recorder && recorder.state !== "inactive") {
    broadcast({ type: "CAPTURE_ERROR", message: "A recording is already in progress." });
    return;
  }
  try {
    // Legacy tabCapture constraint shape (not in the standard lib types).
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId },
      },
    } as unknown as MediaStreamConstraints);

    // Re-route capture to the speakers so the tab stays audible. Offscreen docs
    // have no user activation, so the context can start suspended — resume it.
    audioCtx = new AudioContext();
    audioCtx.createMediaStreamSource(stream).connect(audioCtx.destination);
    if (audioCtx.state === "suspended") await audioCtx.resume().catch(() => undefined);

    // If the captured tab closes, the track ends — finalize + upload what we have.
    stream.getAudioTracks().forEach((t) => {
      t.onended = () => void stop();
    });

    chunks = [];
    bytes = 0;
    recorder = new MediaRecorder(stream, { mimeType: pickMime(), audioBitsPerSecond: 96_000 });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
        bytes += e.data.size;
        broadcast({ type: "CAPTURE_TICK" }); // keep the SW alive across the recording
        if (bytes >= MAX_BYTES) void stop(); // auto-finalize before the server cap
      }
    };
    recorder.onerror = () => {
      broadcast({ type: "CAPTURE_ERROR", message: "Recording stopped unexpectedly." });
    };
    recorder.start(1000); // 1s timeslice so a late failure doesn't lose everything
    startedAt = Date.now();
    ctx = capture;
    broadcast({ type: "CAPTURE_STARTED" });
  } catch (err) {
    cleanup();
    broadcast({ type: "CAPTURE_ERROR", message: friendly(err) });
  }
}

async function stop(freshToken?: string) {
  if (!recorder || recorder.state === "inactive") {
    // Nothing live to stop — still resolve the panel's optimistic "processing".
    broadcast({ type: "CAPTURE_ERROR", message: "Recording already ended — nothing to stop." });
    return;
  }
  const durationSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
  const type = (recorder.mimeType || "audio/webm").split(";")[0]!;

  const blob = await new Promise<Blob>((resolve) => {
    recorder!.onstop = () => resolve(new Blob(chunks, { type }));
    recorder!.stop();
  });

  // Prefer the token captured at stop (the start-time one may have expired during
  // a long recording). `||` (not `??`) so an empty/blank token falls back.
  const capture = ctx ? { ...ctx, token: freshToken?.trim() || ctx.token } : null;
  cleanup();
  broadcast({ type: "CAPTURE_STOPPED" });
  if (!capture || blob.size === 0) {
    broadcast({ type: "CAPTURE_ERROR", message: "Nothing was captured." });
    return;
  }

  pending = { blob, durationSec, capture };
  await runUpload();
}

async function runUpload() {
  if (!pending) return;
  try {
    const sessionId = await upload(pending.blob, pending.durationSec, pending.capture);
    pending = null;
    broadcast({ type: "CAPTURE_UPLOADED", sessionId });
  } catch (err) {
    // Keep `pending` so the user can retry or download instead of losing the audio.
    broadcast({ type: "CAPTURE_ERROR", message: friendly(err), recoverable: true });
  }
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  return body?.error?.message ?? `${fallback} failed (${res.status})`;
}

async function upload(blob: Blob, durationSec: number, { token, appUrl, title }: CaptureCtx) {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-");
  const filename = `tab-recording-${stamp}.webm`;

  const urlRes = await fetch(`${appUrl}/api/sessions/upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      filename,
      contentType: blob.type || "audio/webm",
      sizeBytes: blob.size,
      durationSec,
      source: "EXTENSION",
      title,
    }),
  });
  if (!urlRes.ok) throw new Error(await errorMessage(urlRes, "Upload setup"));
  const { sessionId, path, token: uploadToken } = (await urlRes.json()) as {
    sessionId: string;
    path: string;
    token: string;
  };

  const up = await storage.storage.from(STORAGE_BUCKET).uploadToSignedUrl(path, uploadToken, blob);
  if (up.error) throw new Error(`Upload failed: ${up.error.message}`);

  const ingest = await fetch(`${appUrl}/api/sessions/${sessionId}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ durationSec }),
  });
  if (!ingest.ok) throw new Error(await errorMessage(ingest, "Processing"));

  return sessionId;
}

function downloadPending() {
  if (!pending) return;
  const url = URL.createObjectURL(pending.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `doppio-recording-${Date.now()}.webm`;
  a.click();
  URL.revokeObjectURL(url);
}

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  switch (message.type) {
    case "OFFSCREEN_START":
      void start(message.streamId, {
        token: message.token,
        appUrl: message.appUrl,
        title: message.title,
      });
      break;
    case "OFFSCREEN_STOP":
      void stop(message.token);
      break;
    case "RETRY_UPLOAD":
      if (pending) {
        pending.capture.token = message.token?.trim() || pending.capture.token;
        void runUpload();
      }
      break;
    case "DOWNLOAD_RECORDING":
      downloadPending();
      break;
    case "QUERY_STATE":
      sendResponse({
        type: "CAPTURE_STATE",
        recording: Boolean(recorder && recorder.state === "recording"),
        elapsedMs: recorder && recorder.state === "recording" ? Date.now() - startedAt : 0,
      } satisfies Message);
      return; // synchronous response
  }
  return false;
});
