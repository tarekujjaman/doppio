"use client";

import {
  CheckCircle2,
  CloudUpload,
  Download,
  Loader2,
  Mic,
  Pause,
  Play,
  Square,
  X,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/lib/use-hydrated";
import { useRecorder } from "@/lib/use-recorder";
import { useSessionUpload } from "@/lib/use-session-upload";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  UPLOADED: "Queued…",
  TRANSCRIBING: "Transcribing…",
  SUMMARIZING: "Summarizing…",
};

function fmtElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  return `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, "0")}`;
}

export function UploadAudio() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const hydrated = useHydrated();
  const { state, busy, processFile, showQuotaExceeded, reset } = useSessionUpload();
  const rec = useRecorder();

  // Retain the last attempt so a failed upload never destroys a recording
  // (the file-picker path gets retry for free).
  const lastAttemptRef = useRef<{ file: File; durationSec?: number } | null>(null);

  const recording = rec.status === "recording" || rec.status === "paused";
  const idle = state.phase === "idle" && !recording && rec.status !== "requesting";

  function runUpload(file: File, durationSec?: number) {
    lastAttemptRef.current = { file, durationSec };
    return processFile(file, { durationSec });
  }

  async function startRecording() {
    // Pre-flight quota check so users can't record a take that's doomed to be
    // rejected (fails open on network errors — never block recording on a blip).
    try {
      const res = await fetch("/api/billing");
      if (res.ok) {
        const body = (await res.json()) as {
          usage: { transcribeMinutesThisMonth: number; transcribeMinutesCap: number };
        };
        if (body.usage.transcribeMinutesThisMonth >= body.usage.transcribeMinutesCap) {
          showQuotaExceeded();
          return;
        }
      }
    } catch {
      /* fail open */
    }
    await rec.start();
  }

  async function stopAndTranscribe() {
    const result = await rec.stop();
    if (result) {
      await runUpload(result.file, result.durationSec);
    }
  }

  function discardRecording() {
    if (rec.elapsedMs < 5_000 || window.confirm("Discard this recording? This can't be undone.")) {
      rec.cancel();
    }
  }

  function downloadLastAttempt() {
    const attempt = lastAttemptRef.current;
    if (!attempt) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(attempt.file);
    a.download = attempt.file.name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // Guard against silent data loss: native leave prompt while recording or
  // uploading, and a confirm on in-app link clicks while recording (App Router
  // has no route-blocking API; capture-phase click interception is standard).
  const guardUnload = recording || state.phase === "uploading";
  useEffect(() => {
    if (!guardUnload) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onClickCapture = (e: MouseEvent) => {
      if (!recording) return;
      const link = (e.target as HTMLElement).closest("a[href]");
      if (
        link &&
        !window.confirm("A recording is in progress — leaving this page will discard it. Leave anyway?")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClickCapture, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, [guardUnload, recording]);

  // Keyboard focus follows phase transitions instead of dropping to <body>.
  const stopBtnRef = useRef<HTMLButtonElement>(null);
  const primaryBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (recording) stopBtnRef.current?.focus();
  }, [recording]);
  useEffect(() => {
    if (state.phase === "done" || state.phase === "error") primaryBtnRef.current?.focus();
  }, [state.phase]);

  // Screen-reader announcements: persistent live region (reliable across SRs).
  const liveMessage =
    state.phase === "error"
      ? state.message
      : state.phase === "done"
        ? "Ready — transcript complete."
        : state.phase === "uploading"
          ? "Uploading…"
          : state.phase === "processing"
            ? (STATUS_LABEL[state.status] ?? state.status)
            : rec.status === "recording"
              ? "Recording started."
              : rec.status === "paused"
                ? "Recording paused."
                : (rec.error ?? "");

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f && !busy && rec.status === "inactive") void runUpload(f);
      }}
      data-hydrated={hydrated ? "true" : "false"}
      data-testid="upload-zone"
      className={cn(
        "rounded-2xl border-2 border-dashed bg-white p-8 text-center transition-colors",
        recording ? "border-red-300 bg-red-50/30" : "border-slate-200",
      )}
    >
      <p className="sr-only" role="status" aria-live="polite">
        {liveMessage}
      </p>
      <p className="sr-only" role="alert">
        {state.phase === "error" ? state.message : (rec.error ?? "")}
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="audio/*,video/mp4,video/webm"
        className="hidden"
        data-testid="upload-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && rec.status === "inactive") void runUpload(f);
          e.target.value = "";
        }}
      />

      <div className="mx-auto flex max-w-md flex-col items-center gap-3">
        {idle && (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
              <CloudUpload className="h-6 w-6" />
            </div>
            <div>
              <p className="font-medium text-slate-900">Capture a session</p>
              <p className="mt-0.5 text-sm text-slate-500">
                Record with your microphone, or drop a file — mp3, wav, m4a, mp4, webm · up to
                100MB
              </p>
            </div>
            <div className="mt-1 flex items-center gap-2">
              {rec.supported && (
                <Button onClick={() => void startRecording()} data-testid="record-button">
                  <Mic className="h-4 w-4" />
                  Record now
                </Button>
              )}
              <Button
                variant={rec.supported ? "outline" : "primary"}
                onClick={() => inputRef.current?.click()}
              >
                Choose file
              </Button>
            </div>
            {rec.error && (
              <p className="mt-1 max-w-sm rounded-lg border border-red-100 bg-red-50 p-2.5 text-xs text-red-700">
                {rec.error}
              </p>
            )}
          </>
        )}

        {rec.status === "requesting" && (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
            <p className="font-medium text-slate-900">Waiting for microphone access…</p>
            <p className="text-sm text-slate-500">Allow the microphone when your browser asks.</p>
            <Button variant="ghost" size="sm" onClick={rec.cancel}>
              Cancel
            </Button>
          </>
        )}

        {recording && (
          <>
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <Mic className="h-6 w-6" />
              {rec.status === "recording" && (
                <span className="absolute -right-1 -top-1 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
                </span>
              )}
            </div>

            <p
              className="font-mono text-2xl font-semibold tabular-nums text-slate-900"
              data-testid="record-timer"
              aria-label={`Recording time ${fmtElapsed(rec.elapsedMs)}`}
            >
              {fmtElapsed(rec.elapsedMs)}
            </p>

            {/* Live input level — confirms capture is really happening (INIT-06). */}
            <div
              role="meter"
              aria-label="Microphone input level"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(rec.level * 100)}
              className="h-1.5 w-48 overflow-hidden rounded-full bg-slate-100"
            >
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-100",
                  rec.status === "paused" ? "bg-slate-300" : "bg-red-500",
                )}
                style={{ width: `${Math.round(rec.level * 100)}%` }}
              />
            </div>

            {rec.error ? (
              <p className="max-w-sm text-xs font-medium text-amber-600">{rec.error}</p>
            ) : rec.status === "paused" ? (
              <p className="text-xs text-slate-400">Paused — nothing is being captured.</p>
            ) : rec.silent ? (
              <p className="max-w-sm text-xs font-medium text-amber-600">
                No sound detected — your microphone may be muted. Check your mic or system
                settings.
              </p>
            ) : (
              <p className="text-xs text-slate-400">Recording… speak naturally.</p>
            )}

            <div className="mt-1 flex items-center gap-2">
              <Button ref={stopBtnRef} onClick={() => void stopAndTranscribe()} data-testid="record-stop">
                <Square className="h-3.5 w-3.5" />
                Stop &amp; transcribe
              </Button>
              {rec.status === "recording" ? (
                <Button variant="outline" onClick={rec.pause} aria-label="Pause recording">
                  <Pause className="h-4 w-4" />
                  Pause
                </Button>
              ) : (
                <Button variant="outline" onClick={rec.resume} aria-label="Resume recording">
                  <Play className="h-4 w-4" />
                  Resume
                </Button>
              )}
              <Button variant="ghost" onClick={discardRecording} aria-label="Discard recording">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}

        {(state.phase === "uploading" || state.phase === "processing") && (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
            <p className="font-medium text-slate-900" data-testid="upload-status">
              {state.phase === "uploading"
                ? "Uploading…"
                : (STATUS_LABEL[state.status] ?? state.status)}
            </p>
            <p className="text-sm text-slate-500">You can keep working — this finishes on its own.</p>
          </>
        )}

        {state.phase === "done" && (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="font-medium text-slate-900" data-testid="upload-status">
              Ready
            </p>
            <div className="flex gap-2">
              <Button
                ref={primaryBtnRef}
                variant="outline"
                size="sm"
                onClick={() => {
                  lastAttemptRef.current = null;
                  reset();
                }}
              >
                Capture another
              </Button>
            </div>
          </>
        )}

        {state.phase === "error" && (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <XCircle className="h-6 w-6" />
            </div>
            <p
              className={state.quotaExceeded ? "font-medium text-slate-900" : "font-medium text-red-700"}
              data-testid="upload-status"
            >
              {state.message}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {state.quotaExceeded ? (
                <Button
                  ref={primaryBtnRef}
                  size="sm"
                  onClick={() => router.push("/billing")}
                  data-testid="upgrade-prompt"
                >
                  Upgrade to Pro
                </Button>
              ) : (
                <Button
                  ref={primaryBtnRef}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const attempt = lastAttemptRef.current;
                    if (attempt) void processFile(attempt.file, { durationSec: attempt.durationSec });
                    else reset();
                  }}
                >
                  Try again
                </Button>
              )}
              {lastAttemptRef.current && (
                <Button variant="outline" size="sm" onClick={downloadLastAttempt}>
                  <Download className="h-3.5 w-3.5" />
                  Save audio
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  lastAttemptRef.current = null;
                  reset();
                }}
              >
                Dismiss
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
