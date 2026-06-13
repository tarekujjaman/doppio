import { STORAGE_BUCKET } from "../lib/config";
import type { Message } from "../lib/messages";
import { getAccessToken, supabase } from "../lib/supabase";

// Auto-finalize before the server's 25MB cap so a long recording is saved
// (transcribed up to here) instead of rejected and lost.
const MAX_BYTES = 24 * 1024 * 1024;

let recorder: MediaRecorder | null = null;
let stream: MediaStream | null = null;
let audioCtx: AudioContext | null = null;
let chunks: Blob[] = [];
let bytes = 0;
let startedAt = 0;
let appUrl = "";
let title = "";
// Holds a finished-but-not-yet-uploaded recording so a failed upload is retryable.
let pending: { blob: Blob; durationSec: number } | null = null;

function broadcast(message: Message) {
  chrome.runtime.sendMessage(message).catch(() => {});
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

async function start(streamId: string, app: string, tabTitle: string) {
  if (recorder && recorder.state !== "inactive") {
    broadcast({ type: "CAPTURE_ERROR", message: "A recording is already in progress." });
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId } },
    } as unknown as MediaStreamConstraints);

    // Re-route capture to the speakers so the tab stays audible.
    audioCtx = new AudioContext();
    audioCtx.createMediaStreamSource(stream).connect(audioCtx.destination);
    if (audioCtx.state === "suspended") await audioCtx.resume().catch(() => undefined);

    // If the captured tab closes, finalize + upload what we have.
    stream.getAudioTracks().forEach((t) => {
      t.onended = () => void stop();
    });

    chunks = [];
    bytes = 0;
    appUrl = app;
    title = tabTitle;
    recorder = new MediaRecorder(stream, { mimeType: pickMime(), audioBitsPerSecond: 96_000 });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
        bytes += e.data.size;
        broadcast({ type: "CAPTURE_TICK" }); // keep the SW alive across the recording
        if (bytes >= MAX_BYTES) void stop(); // auto-finalize before the server cap
      }
    };
    recorder.onerror = () =>
      broadcast({ type: "CAPTURE_ERROR", message: "Recording stopped unexpectedly." });
    recorder.start(1000);
    startedAt = Date.now();
    broadcast({ type: "CAPTURE_STARTED" });
  } catch (err) {
    cleanup();
    broadcast({ type: "CAPTURE_ERROR", message: friendly(err) });
  }
}

async function stop() {
  if (!recorder || recorder.state === "inactive") {
    broadcast({ type: "CAPTURE_ERROR", message: "Recording already ended — nothing to stop." });
    return;
  }
  const durationSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
  const type = (recorder.mimeType || "audio/webm").split(";")[0]!;

  const blob = await new Promise<Blob>((resolve) => {
    recorder!.onstop = () => resolve(new Blob(chunks, { type }));
    recorder!.stop();
  });

  cleanup();
  broadcast({ type: "CAPTURE_STOPPED" });
  if (blob.size === 0) {
    broadcast({ type: "CAPTURE_ERROR", message: "Nothing was captured." });
    return;
  }

  pending = { blob, durationSec };
  await runUpload();
}

async function runUpload() {
  if (!pending) return;
  try {
    const token = await getAccessToken();
    if (!token) throw new Error("Sign in to save this recording.");
    const sessionId = await upload(pending.blob, pending.durationSec, token);
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

async function upload(blob: Blob, durationSec: number, token: string) {
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

  const up = await supabase.storage.from(STORAGE_BUCKET).uploadToSignedUrl(path, uploadToken, blob);
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
      void start(message.streamId, message.appUrl, message.title);
      break;
    case "OFFSCREEN_STOP":
      void stop();
      break;
    case "RETRY_UPLOAD":
      if (pending) void runUpload();
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
      return;
  }
  return false;
});
