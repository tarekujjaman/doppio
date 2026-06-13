import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, STORAGE_BUCKET } from "../lib/config";
import type { Message } from "../lib/messages";

// Storage-only client (signed uploads need no auth — the token authorizes).
const storage = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface CaptureCtx {
  token: string;
  appUrl: string;
  title: string;
}

let recorder: MediaRecorder | null = null;
let stream: MediaStream | null = null;
let audioCtx: AudioContext | null = null;
let chunks: Blob[] = [];
let startedAt = 0;
let ctx: CaptureCtx | null = null;

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
  try {
    // Legacy tabCapture constraint shape (not in the standard lib types).
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId },
      },
    } as unknown as MediaStreamConstraints);

    // Re-route capture to the speakers so the tab stays audible to the user.
    audioCtx = new AudioContext();
    audioCtx.createMediaStreamSource(stream).connect(audioCtx.destination);

    chunks = [];
    recorder = new MediaRecorder(stream, { mimeType: pickMime() });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
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
  if (!recorder || recorder.state === "inactive") return;
  const durationSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
  const type = (recorder.mimeType || "audio/webm").split(";")[0]!;

  const blob = await new Promise<Blob>((resolve) => {
    recorder!.onstop = () => resolve(new Blob(chunks, { type }));
    recorder!.stop();
  });

  // Prefer the token captured at stop (the start-time one may have expired
  // during a long recording).
  const capture = ctx ? { ...ctx, token: freshToken ?? ctx.token } : null;
  cleanup();
  broadcast({ type: "CAPTURE_STOPPED" });
  if (!capture || blob.size === 0) {
    broadcast({ type: "CAPTURE_ERROR", message: "Nothing was captured." });
    return;
  }

  try {
    const sessionId = await upload(blob, durationSec, capture);
    broadcast({ type: "CAPTURE_UPLOADED", sessionId });
  } catch (err) {
    broadcast({ type: "CAPTURE_ERROR", message: friendly(err) });
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

chrome.runtime.onMessage.addListener((message: Message) => {
  if (message.type === "OFFSCREEN_START") {
    void start(message.streamId, {
      token: message.token,
      appUrl: message.appUrl,
      title: message.title,
    });
  } else if (message.type === "OFFSCREEN_STOP") {
    void stop(message.token);
  }
});
