"use client";

import { useEffect, useRef, useState } from "react";

export type RecorderStatus = "inactive" | "requesting" | "recording" | "paused";

export interface RecordingResult {
  file: File;
  durationSec: number;
}

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
}

function friendlyMicError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone access was blocked. Allow the microphone for this site in your browser settings, then try again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No microphone found. Plug one in or check your input settings.";
  }
  if (name === "NotReadableError") {
    return "The microphone is in use by another app. Close it and try again.";
  }
  return err instanceof Error ? err.message : "Could not start recording.";
}

/**
 * In-browser mic recording (web slice of INIT-06/MVP-14): MediaRecorder with
 * pause-aware elapsed time, a live input-level meter, sustained-silence
 * detection (OS-muted mics), and recovery when the device disconnects
 * mid-recording (USB unplugged, Bluetooth died, permission revoked).
 */
export function useRecorder() {
  const [status, setStatus] = useState<RecorderStatus>("inactive");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [level, setLevel] = useState(0); // 0..1 RMS-ish input level
  const [silent, setSilent] = useState(false); // sustained no-signal while recording
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const segmentStartRef = useRef(0); // wall-clock start of the current run segment
  const accumulatedRef = useRef(0); // ms recorded before the current segment
  const meterPausedRef = useRef(false);
  const silentSinceRef = useRef<number | null>(null);
  const cancelStopRef = useRef<(() => void) | null>(null); // defuses an in-flight stop()
  const startGenRef = useRef(0); // aborts a pending getUserMedia when cancelled

  useEffect(() => {
    setSupported(
      typeof navigator !== "undefined" &&
        Boolean(navigator.mediaDevices?.getUserMedia) &&
        typeof MediaRecorder !== "undefined",
    );
    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cleanup() {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    recorderRef.current = null;
    silentSinceRef.current = null;
  }

  function currentElapsed(): number {
    return (
      accumulatedRef.current + (segmentStartRef.current ? Date.now() - segmentStartRef.current : 0)
    );
  }

  function startTimer() {
    segmentStartRef.current = Date.now();
    tickRef.current = setInterval(() => setElapsedMs(currentElapsed()), 250);
  }

  function pauseTimer() {
    accumulatedRef.current = currentElapsed();
    segmentStartRef.current = 0;
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    setElapsedMs(accumulatedRef.current);
  }

  /** Device disconnect / recorder failure: freeze time, surface it, keep chunks salvageable. */
  function handleExternalEnd(recorder: MediaRecorder, message: string) {
    if (recorderRef.current !== recorder) return; // stale recording
    pauseTimer();
    meterPausedRef.current = true;
    setLevel(0);
    setStatus("paused");
    setError(message);
  }

  async function start() {
    setError(null);
    setSilent(false);
    setStatus("requesting");
    const gen = ++startGenRef.current;

    // Create the AudioContext synchronously in the user-gesture call stack so
    // Safari doesn't start it 'suspended' (the meter would read 0 otherwise).
    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    audioCtxRef.current = ctx;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (gen !== startGenRef.current) {
        // Cancelled while the permission prompt was open — don't turn the mic on.
        stream.getTracks().forEach((t) => t.stop());
        void ctx.close().catch(() => undefined);
        return;
      }
      streamRef.current = stream;
      if (ctx.state === "suspended") void ctx.resume();

      // Live level meter + sustained-silence detection (OS-muted mic yields ~0 RMS).
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      meterPausedRef.current = false;
      const meter = () => {
        rafRef.current = requestAnimationFrame(meter);
        if (meterPausedRef.current) return;
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) {
          const c = (v - 128) / 128;
          sum += c * c;
        }
        const rms = Math.sqrt(sum / buf.length);
        setLevel(Math.min(1, rms * 3));
        if (recorderRef.current?.state === "recording") {
          if (rms < 0.004) {
            silentSinceRef.current ??= Date.now();
            if (Date.now() - silentSinceRef.current > 5000) setSilent(true);
          } else {
            silentSinceRef.current = null;
            setSilent(false);
          }
        }
      };
      rafRef.current = requestAnimationFrame(meter);

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onerror = () =>
        handleExternalEnd(
          recorder,
          "Recording stopped unexpectedly. “Stop & transcribe” keeps what was captured.",
        );
      stream.getAudioTracks().forEach((t) => {
        t.addEventListener("ended", () =>
          handleExternalEnd(
            recorder,
            "The microphone disconnected. “Stop & transcribe” keeps what was captured, or discard it.",
          ),
        );
        if (t.muted) setSilent(true);
      });

      accumulatedRef.current = 0;
      setElapsedMs(0);
      // timeslice: flush a chunk every second so a late recorder failure
      // doesn't lose the whole take (chunks are still memory-only).
      recorder.start(1000);
      startTimer();
      setStatus("recording");
    } catch (err) {
      if (gen !== startGenRef.current) return; // cancelled while pending
      cleanup();
      setStatus("inactive");
      setError(friendlyMicError(err));
    }
  }

  function pause() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.pause();
      pauseTimer();
      meterPausedRef.current = true;
      setLevel(0);
      setStatus("paused");
    }
  }

  function resume() {
    if (recorderRef.current?.state === "paused") {
      recorderRef.current.resume();
      startTimer();
      meterPausedRef.current = false;
      setStatus("recording");
    }
  }

  /** Stops and resolves with the finished file + measured duration. */
  async function stop(): Promise<RecordingResult | null> {
    const recorder = recorderRef.current;
    if (!recorder) return null;

    pauseTimer();
    const durationSec = Math.max(1, Math.round(accumulatedRef.current / 1000));
    const type = (recorder.mimeType || "audio/webm").split(";")[0]!;

    const blob =
      recorder.state === "inactive"
        ? // Recorder ended on its own (device disconnect) — chunks are final.
          new Blob(chunksRef.current, { type })
        : await new Promise<Blob | null>((resolve) => {
            cancelStopRef.current = () => resolve(null);
            recorder.onstop = () => resolve(new Blob(chunksRef.current, { type }));
            recorder.stop();
          });
    cancelStopRef.current = null;

    cleanup();
    setStatus("inactive");
    setLevel(0);
    setSilent(false);

    if (!blob || blob.size === 0) return null; // cancelled mid-stop, or nothing captured

    const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-");

    // webm → WAV so the recording routes to TwinMind (best Bangla) instead of
    // the webm-only Whisper fallback. mp4/m4a (iOS) is already TwinMind-supported.
    let outBlob = blob;
    let ext = blob.type.includes("mp4") ? "m4a" : "webm";
    if (ext === "webm") {
      try {
        const { toWav } = await import("@/lib/wav");
        const wav = await toWav(blob);
        // Only use the WAV if it fits the upload cap; otherwise keep the compact
        // webm (a long recording → Whisper rather than a too-large WAV → 413).
        if (wav.size <= 24 * 1024 * 1024) {
          outBlob = wav;
          ext = "wav";
        }
      } catch {
        // decode/encode failed — fall back to the original webm (Whisper handles it)
      }
    }

    const file = new File([outBlob], `recording-${stamp}.${ext}`, { type: outBlob.type });
    return { file, durationSec };
  }

  function cancel() {
    startGenRef.current++; // aborts a pending getUserMedia
    if (recorderRef.current) {
      recorderRef.current.onstop = null;
      if (recorderRef.current.state !== "inactive") recorderRef.current.stop();
    }
    cancelStopRef.current?.(); // defuse an awaiting stop() — first resolution (null) wins
    cancelStopRef.current = null;
    chunksRef.current = [];
    cleanup();
    setStatus("inactive");
    setLevel(0);
    setSilent(false);
    setElapsedMs(0);
    setError(null);
  }

  return {
    status,
    elapsedMs,
    level,
    silent,
    error,
    supported,
    start,
    pause,
    resume,
    stop,
    cancel,
  };
}
