import type { Message } from "../lib/messages";

// ── Live chunked capture ───────────────────────────────────────────────────
// Instead of recording one big webm and transcribing it after Stop, we tap the
// tab's audio, slice it into ~90s 16kHz-mono WAV chunks, and POST each chunk to
// /transcribe-chunk while the meeting is still running. The transcript fills in
// live; by the time the user hits Stop, only the final chunk is outstanding, so
// /finalize (summary + action items) lands within seconds.
//
// WAV (not webm) means the fast primary STT engine (TwinMind) handles it — no
// slow Whisper fallback, no Bangla double-pass. A 90s chunk is ~2.9MB, under
// Vercel's ~4.5MB body limit, so chunks POST directly (no Storage round-trip;
// audio never persists anywhere).

const TARGET_RATE = 16_000; // STT-friendly mono sample rate
const CHUNK_SEC = 90; // ~2.9MB/chunk @ 16kHz mono 16-bit; fewer calls = cheaper
const MAX_MINUTES = 120; // hard cap so a forgotten recording can't run forever
const KEEPALIVE_MS = 20_000; // ping so Chrome doesn't suspend us between chunks

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let appUrl = "";
let title = "";
let startToken = ""; // token captured at start (refreshed on 401), used for chunk + finalize
let sessionId: string | null = null;
let pendingFinalize: { id: string; durationSec: number } | null = null; // kept for retry

let stream: MediaStream | null = null;
let audioCtx: AudioContext | null = null;
let processor: ScriptProcessorNode | null = null;

let recording = false;
let paused = false;
let finishing = false; // guards re-entrant stop/discard

// Pause-aware wall-clock elapsed (for the panel timer).
let accumulatedMs = 0;
let segmentStart = 0;

// Mono PCM at the context's native rate, accumulated until a chunk is cut.
let monoBuffers: Float32Array[] = [];
let bufferedSamples = 0;
let emittedCtxSamples = 0; // samples already cut into chunks → drives chunk startMs
let ctxRate = 48_000;
let chunkIndex = 0;

// Chunk upload queue (sequential, in order).
type Chunk = { index: number; startMs: number; durationMs: number; wav: Uint8Array };
let queue: Chunk[] = [];
let drainingPromise: Promise<void> | null = null;
let transcribedMs = 0; // audio confirmed transcribed (sum of posted chunk durations)
let dropped = 0; // chunks that failed every retry

let keepalive: ReturnType<typeof setInterval> | null = null;
let lastLevelMs = 0;

function broadcast(message: Message) {
  chrome.runtime.sendMessage(message).catch(() => {});
}

function friendly(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError") return "Tab capture was blocked.";
  if (err instanceof Error) return err.message;
  return String(err);
}

async function apiErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  return body?.error?.message ?? `${fallback} (${res.status})`;
}

/** fetch with a hard timeout so a stalled upload can't hang the queue forever. */
async function fetchWithTimeout(url: string, init: RequestInit, ms = 45_000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Ask the SW to refresh the access token (offscreen can't read chrome.storage). */
async function requestFreshToken(): Promise<string | null> {
  try {
    const resp = (await chrome.runtime.sendMessage({ type: "GET_FRESH_TOKEN" } satisfies Message)) as
      | { token?: string | null }
      | undefined;
    return resp?.token ?? null;
  } catch {
    return null;
  }
}

function elapsedMs(): number {
  return accumulatedMs + (segmentStart ? Date.now() - segmentStart : 0);
}

// ── Audio plumbing ──────────────────────────────────────────────────────────

function onAudio(e: AudioProcessingEvent) {
  // Output silence: we connect the processor to destination only to keep it
  // pulled; the audible path is source → destination set up separately.
  e.outputBuffer.getChannelData(0).fill(0);
  if (!recording || paused) return;

  const input = e.inputBuffer.getChannelData(0); // mono (processor declared 1 ch)

  // Throttled RMS level for the meter (speech RMS is small → scale up + clamp).
  const now = Date.now();
  if (now - lastLevelMs > 100) {
    let sum = 0;
    for (let i = 0; i < input.length; i++) sum += input[i]! * input[i]!;
    const rms = Math.sqrt(sum / input.length);
    broadcast({ type: "CAPTURE_LEVEL", level: Math.min(1, rms * 5) });
    lastLevelMs = now;
  }

  monoBuffers.push(new Float32Array(input)); // copy — the event buffer is reused
  bufferedSamples += input.length;

  if (bufferedSamples >= CHUNK_SEC * ctxRate) {
    // Defer the (heavy) downsample + WAV-encode off the audio callback so we
    // don't glitch the render quantum every ~90s; the grab itself is cheap.
    const grabbed = grabBuffer();
    if (grabbed) queueMicrotask(() => enqueueChunk(grabbed));
  }

  const recordedSec = (emittedCtxSamples + bufferedSamples) / ctxRate;
  if (recordedSec >= MAX_MINUTES * 60) void stop(startToken);
}

interface Grabbed {
  buffers: Float32Array[];
  chunkSamples: number;
  startMs: number;
  rate: number;
}

/** Cheap, synchronous: detach the buffered samples and advance the timeline. */
function grabBuffer(): Grabbed | null {
  if (bufferedSamples === 0 || !sessionId) return null;
  const chunkSamples = bufferedSamples;
  const buffers = monoBuffers;
  monoBuffers = [];
  const startMs = Math.floor((emittedCtxSamples / ctxRate) * 1000);
  emittedCtxSamples += chunkSamples;
  bufferedSamples = 0;
  return { buffers, chunkSamples, startMs, rate: ctxRate };
}

/** Heavy: concat + downsample + WAV-encode, then enqueue for upload. */
function enqueueChunk(g: Grabbed): void {
  const merged = concat(g.buffers, g.chunkSamples);
  const wav = encodeWav(downsample(merged, g.rate, TARGET_RATE), TARGET_RATE);
  queue.push({
    index: chunkIndex++,
    startMs: g.startMs,
    durationMs: Math.round((g.chunkSamples / g.rate) * 1000),
    wav,
  });
  kickQueue();
}

function concat(list: Float32Array[], total: number): Float32Array {
  const out = new Float32Array(total);
  let off = 0;
  for (const b of list) {
    out.set(b, off);
    off += b.length;
  }
  return out;
}

function downsample(buf: Float32Array, inRate: number, outRate: number): Float32Array {
  if (outRate >= inRate) return buf;
  const ratio = inRate / outRate;
  const outLen = Math.floor(buf.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const idx = i * ratio;
    const i0 = Math.floor(idx);
    const i1 = Math.min(i0 + 1, buf.length - 1);
    const frac = idx - i0;
    out[i] = buf[i0]! * (1 - frac) + buf[i1]! * frac;
  }
  return out;
}

function encodeWav(samples: Float32Array, rate: number): Uint8Array {
  const n = samples.length;
  const buffer = new ArrayBuffer(44 + n * 2);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + n * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, n * 2, true);
  let off = 44;
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Uint8Array(buffer);
}

// ── Chunk upload queue ───────────────────────────────────────────────────────

function kickQueue(): void {
  if (!drainingPromise) drainingPromise = drain().finally(() => (drainingPromise = null));
}

async function drain(): Promise<void> {
  while (queue.length > 0) {
    const item = queue[0]!;
    const ok = await postChunk(item); // best-effort: a failed chunk is dropped, meeting continues
    queue.shift();
    if (ok) transcribedMs += item.durationMs;
    else dropped++;
    broadcast({ type: "CAPTURE_TICK" });
    broadcast({ type: "CAPTURE_PROGRESS", transcribedMs, dropped });
  }
}

async function waitForQueue(): Promise<void> {
  kickQueue();
  while (drainingPromise) await drainingPromise;
}

async function postChunk(item: Chunk): Promise<boolean> {
  if (!sessionId) return false;
  const url = `${appUrl}/api/sessions/${sessionId}/transcribe-chunk?index=${item.index}&startMs=${item.startMs}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetchWithTimeout(url, {
        method: "POST",
        headers: { "Content-Type": "audio/wav", Authorization: `Bearer ${startToken}` },
        body: item.wav as BodyInit,
      });
      if (res.ok) return true;
      if (res.status === 401) {
        // token expired mid-recording → refresh once and retry with it
        const fresh = await requestFreshToken();
        if (fresh && fresh !== startToken) {
          startToken = fresh;
          continue; // retry immediately with the new token
        }
        return false;
      }
      if ([400, 402, 404, 409, 413].includes(res.status)) return false; // not retryable
    } catch {
      /* network / timeout — retry */
    }
    await sleep(1000 * (attempt + 1));
  }
  return false;
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

async function start(streamId: string, app: string, tabTitle: string, token: string) {
  if (recording) {
    broadcast({ type: "CAPTURE_ERROR", message: "A recording is already in progress." });
    return;
  }
  appUrl = app;
  title = tabTitle;
  startToken = token;
  finishing = false;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId } },
    } as unknown as MediaStreamConstraints);

    // Open the live session up front so chunks have somewhere to land.
    const res = await fetchWithTimeout(`${appUrl}/api/sessions/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: title.slice(0, 200) || "Live recording", source: "EXTENSION" }),
    });
    if (!res.ok) {
      // 402 = over the monthly quota → let the panel offer an Upgrade CTA.
      throw Object.assign(new Error(await apiErrorMessage(res, "Couldn't start the session")), {
        quota: res.status === 402,
      });
    }
    sessionId = ((await res.json()) as { sessionId: string }).sessionId;

    audioCtx = new AudioContext();
    ctxRate = audioCtx.sampleRate;
    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(audioCtx.destination); // keep the tab audible

    processor = audioCtx.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = onAudio;
    source.connect(processor);
    processor.connect(audioCtx.destination); // pull the processor (it outputs silence)
    if (audioCtx.state === "suspended") await audioCtx.resume().catch(() => undefined);

    // If the captured tab closes, finalize what we have with the start token.
    stream.getAudioTracks().forEach((t) => {
      t.onended = () => void stop(startToken);
    });

    // Reset accumulators and go live.
    monoBuffers = [];
    bufferedSamples = 0;
    emittedCtxSamples = 0;
    chunkIndex = 0;
    queue = [];
    transcribedMs = 0;
    dropped = 0;
    lastLevelMs = 0;
    pendingFinalize = null;
    accumulatedMs = 0;
    segmentStart = Date.now();
    paused = false;
    recording = true;

    keepalive = setInterval(() => broadcast({ type: "CAPTURE_TICK" }), KEEPALIVE_MS);
    broadcast({ type: "CAPTURE_STARTED", sessionId });
  } catch (err) {
    teardownAudio();
    sessionId = null;
    broadcast({ type: "CAPTURE_ERROR", message: friendly(err), upgrade: (err as { quota?: boolean }).quota });
  }
}

function pause() {
  if (recording && !paused) {
    paused = true;
    accumulatedMs += segmentStart ? Date.now() - segmentStart : 0;
    segmentStart = 0;
    broadcast({ type: "CAPTURE_PAUSED" });
  }
}

function resume() {
  if (recording && paused) {
    paused = false;
    segmentStart = Date.now();
    broadcast({ type: "CAPTURE_RESUMED" });
  }
}

async function stop(token: string) {
  if (finishing) return;
  if (!recording || !sessionId) {
    broadcast({ type: "CAPTURE_ERROR", message: "Recording already ended — nothing to stop." });
    return;
  }
  finishing = true;
  recording = false;
  accumulatedMs = elapsedMs();
  segmentStart = 0;
  if (token) startToken = token;
  const id = sessionId;
  const durationSec = Math.max(1, Math.round(accumulatedMs / 1000));

  teardownAudio();
  const tail = grabBuffer(); // flush the final partial chunk (sync, before waitForQueue)
  if (tail) enqueueChunk(tail);
  broadcast({ type: "CAPTURE_STOPPED" });

  await waitForQueue(); // every chunk transcribed before we summarize
  await runFinalize(id, durationSec);
}

/** POST finalize; on a recoverable failure keep state so the panel can Retry. */
async function runFinalize(id: string, durationSec: number): Promise<void> {
  const post = () =>
    fetchWithTimeout(`${appUrl}/api/sessions/${id}/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${startToken}` },
      body: JSON.stringify({ durationSec }),
    });
  try {
    let res = await post();
    if (res.status === 401) {
      const fresh = await requestFreshToken();
      if (fresh) {
        startToken = fresh;
        res = await post();
      }
    }
    if (!res.ok) {
      const message = await apiErrorMessage(res, "Couldn't finish processing");
      // 5xx → transient, worth a retry; 4xx → bad state/quota, not retryable.
      throw Object.assign(new Error(message), { recoverable: res.status >= 500 });
    }
    pendingFinalize = null;
    broadcast({ type: "CAPTURE_UPLOADED", sessionId: id });
    resetState();
  } catch (err) {
    const recoverable = (err as { recoverable?: boolean }).recoverable ?? true; // network/timeout
    if (recoverable) {
      pendingFinalize = { id, durationSec };
      finishing = false; // let the panel retry
      broadcast({ type: "CAPTURE_ERROR", message: friendly(err), recoverable: true });
    } else {
      pendingFinalize = null;
      broadcast({ type: "CAPTURE_ERROR", message: friendly(err) });
      resetState();
    }
  }
}

/** Panel "Retry" after a recoverable finalize failure. */
async function retryFinalize(token: string): Promise<void> {
  if (!pendingFinalize || finishing) return;
  finishing = true;
  if (token) startToken = token;
  broadcast({ type: "CAPTURE_STOPPED" });
  await runFinalize(pendingFinalize.id, pendingFinalize.durationSec);
}

async function discard() {
  if (finishing) return;
  finishing = true;
  recording = false;
  const id = sessionId;
  teardownAudio();
  queue = [];
  broadcast({ type: "CAPTURE_DISCARDED" });
  // Drop the half-recorded session so it doesn't linger in the list.
  if (id) {
    await fetchWithTimeout(`${appUrl}/api/sessions/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${startToken}` },
    }).catch(() => {});
  }
  resetState();
}

function teardownAudio() {
  if (keepalive) {
    clearInterval(keepalive);
    keepalive = null;
  }
  if (processor) {
    processor.onaudioprocess = null;
    processor.disconnect();
    processor = null;
  }
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  void audioCtx?.close().catch(() => undefined);
  audioCtx = null;
}

function resetState() {
  recording = false;
  paused = false;
  finishing = false;
  sessionId = null;
  monoBuffers = [];
  bufferedSamples = 0;
  emittedCtxSamples = 0;
  chunkIndex = 0;
  queue = [];
  transcribedMs = 0;
  dropped = 0;
  pendingFinalize = null;
  accumulatedMs = 0;
  segmentStart = 0;
}

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  switch (message.type) {
    case "OFFSCREEN_START":
      void start(message.streamId, message.appUrl, message.title, message.token);
      break;
    case "OFFSCREEN_STOP":
      void stop(message.token);
      break;
    case "OFFSCREEN_RETRY":
      void retryFinalize(message.token);
      break;
    case "OFFSCREEN_PAUSE":
      pause();
      break;
    case "OFFSCREEN_RESUME":
      resume();
      break;
    case "OFFSCREEN_DISCARD":
      void discard();
      break;
    case "QUERY_STATE":
      sendResponse({
        type: "CAPTURE_STATE",
        recording,
        paused,
        elapsedMs: recording ? elapsedMs() : 0,
        sessionId: sessionId ?? undefined,
      } satisfies Message);
      return;
  }
  return false;
});
