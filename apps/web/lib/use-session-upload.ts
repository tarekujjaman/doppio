"use client";

import type { SessionStatus } from "@doppio/core";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type UploadState =
  | { phase: "idle" }
  | { phase: "uploading" }
  | { phase: "processing"; status: SessionStatus; sessionId: string }
  | { phase: "done"; sessionId: string }
  | { phase: "error"; message: string; quotaExceeded?: boolean };

const QUOTA_MESSAGE = "You've used all your transcription minutes for this month.";

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

/**
 * Shared upload → ingest → poll state machine (MVP-35), used by both the
 * file-picker path and the in-browser recorder (which passes its own measured
 * duration — MediaRecorder webm blobs often probe as Infinity).
 */
export function useSessionUpload() {
  const router = useRouter();
  const [state, setState] = useState<UploadState>({ phase: "idle" });

  // Reentrancy guard: a ref (not the closure's `busy`) so stale handlers are
  // also rejected (double-click, drop during upload).
  const inFlightRef = useRef(false);
  // Unmount guard: stop polling side effects after navigation away.
  const activeRef = useRef(true);
  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);

  const busy = state.phase === "uploading" || state.phase === "processing";

  /** Surfaces the quota-exceeded UI without a doomed upload (record pre-flight). */
  function showQuotaExceeded() {
    setState({ phase: "error", message: QUOTA_MESSAGE, quotaExceeded: true });
  }

  async function processFile(file: File, opts: { durationSec?: number } = {}) {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      setState({ phase: "uploading" });
      const durationSec = opts.durationSec ?? (await probeDurationSec(file));

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
        if (body?.error?.code === "QUOTA_EXCEEDED" || body?.error?.code === "BUDGET_EXCEEDED") {
          showQuotaExceeded();
          return;
        }
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
          showQuotaExceeded();
          return;
        }
        throw new Error(body?.error?.message ?? `Processing failed to start (${ingest.status})`);
      }

      if (!activeRef.current) return;
      setState({ phase: "processing", status: "TRANSCRIBING", sessionId });

      const deadline = Date.now() + 5 * 60_000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2000));
        if (!activeRef.current) return; // navigated away — server finishes on its own

        let poll: Response;
        try {
          poll = await fetch(`/api/sessions/${sessionId}`);
        } catch {
          continue; // transient network blip — keep polling; deadline bounds the loop
        }
        if (!poll.ok) continue;

        const { session } = (await poll.json().catch(() => ({ session: null }))) as {
          session: { status: SessionStatus } | null;
        };
        if (!session || !activeRef.current) continue;

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
      if (activeRef.current) {
        setState({ phase: "error", message: err instanceof Error ? err.message : String(err) });
      }
    } finally {
      inFlightRef.current = false;
    }
  }

  return {
    state,
    busy,
    processFile,
    showQuotaExceeded,
    reset: () => setState({ phase: "idle" }),
  };
}
