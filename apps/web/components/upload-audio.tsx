"use client";

import type { SessionStatus } from "@doppio/core";
import { CheckCircle2, CloudUpload, Loader2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type UploadState =
  | { phase: "idle" }
  | { phase: "uploading" }
  | { phase: "processing"; status: SessionStatus; sessionId: string }
  | { phase: "done"; sessionId: string }
  | { phase: "error"; message: string; quotaExceeded?: boolean };

async function probeDurationSec(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      const d = audio.duration;
      resolve(Number.isFinite(d) && d > 0 ? Math.ceil(d) : undefined);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(undefined);
    };
    audio.src = url;
  });
}

const STATUS_LABEL: Record<string, string> = {
  UPLOADED: "Queued…",
  TRANSCRIBING: "Transcribing…",
  SUMMARIZING: "Summarizing…",
};

export function UploadAudio() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({ phase: "idle" });
  const [dragging, setDragging] = useState(false);
  // Deterministic hydration sentinel — e2e waits on it before interacting.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const busy = state.phase === "uploading" || state.phase === "processing";

  async function handleFile(file: File) {
    try {
      setState({ phase: "uploading" });
      const durationSec = await probeDurationSec(file);

      const res = await fetch("/api/sessions/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "audio/mpeg",
          sizeBytes: file.size,
          durationSec,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? `Upload setup failed (${res.status})`);
      }
      const { sessionId, path, token } = (await res.json()) as {
        sessionId: string;
        path: string;
        token: string;
      };

      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from("doppio-audio")
        .uploadToSignedUrl(path, token, file);
      if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

      const ingest = await fetch(`/api/sessions/${sessionId}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationSec }),
      });
      if (!ingest.ok) {
        const body = await ingest.json().catch(() => null);
        if (body?.error?.code === "QUOTA_EXCEEDED" || body?.error?.code === "BUDGET_EXCEEDED") {
          setState({
            phase: "error",
            message: "You've used all your transcription minutes for this month.",
            quotaExceeded: true,
          });
          return;
        }
        throw new Error(body?.error?.message ?? `Processing failed to start (${ingest.status})`);
      }

      setState({ phase: "processing", status: "TRANSCRIBING", sessionId });

      const deadline = Date.now() + 5 * 60_000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2000));
        const poll = await fetch(`/api/sessions/${sessionId}`);
        if (!poll.ok) continue;
        const { session } = (await poll.json()) as { session: { status: SessionStatus } };
        if (session.status === "READY") {
          setState({ phase: "done", sessionId });
          router.refresh();
          return;
        }
        if (session.status === "FAILED") throw new Error("Processing failed — please try again.");
        setState({ phase: "processing", status: session.status, sessionId });
      }
      throw new Error("Timed out while processing. Check the sessions list shortly.");
    } catch (err) {
      setState({ phase: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f && !busy) void handleFile(f);
      }}
      data-hydrated={hydrated ? "true" : "false"}
      data-testid="upload-zone"
      className={cn(
        "rounded-2xl border-2 border-dashed bg-white p-8 text-center transition-colors",
        dragging ? "border-primary-400 bg-primary-50/50" : "border-slate-200",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,video/mp4,video/webm"
        className="hidden"
        data-testid="upload-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />

      <div className="mx-auto flex max-w-md flex-col items-center gap-3">
        {state.phase === "idle" && (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
              <CloudUpload className="h-6 w-6" />
            </div>
            <div>
              <p className="font-medium text-slate-900">Upload a recording</p>
              <p className="mt-0.5 text-sm text-slate-500">
                Drag &amp; drop or choose a file — mp3, wav, m4a, mp4, webm · up to 100MB
              </p>
            </div>
            <Button onClick={() => inputRef.current?.click()} className="mt-1">
              Choose file
            </Button>
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
            <p className="text-sm text-slate-500">
              You can keep working — this finishes on its own.
            </p>
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
              <Button variant="outline" size="sm" onClick={() => setState({ phase: "idle" })}>
                Upload another
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
            {state.quotaExceeded ? (
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => (window.location.href = "/billing")} data-testid="upgrade-prompt">
                  Upgrade to Pro
                </Button>
                <Button variant="outline" size="sm" onClick={() => setState({ phase: "idle" })}>
                  Dismiss
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setState({ phase: "idle" })}>
                Try again
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
