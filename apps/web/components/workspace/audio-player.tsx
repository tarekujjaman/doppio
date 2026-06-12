"use client";

import { Loader2, Pause, Play } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type WaveSurfer from "wavesurfer.js";
import { fmtMs } from "./types";

export interface AudioPlayerHandle {
  seekToMs(ms: number): void;
}

type LoadState = "loading" | "ready" | "no-audio" | "error";

/** Wavesurfer player (MVP-30): waveform, play/pause, exposes time + seek. */
export const AudioPlayer = forwardRef<
  AudioPlayerHandle,
  { sessionId: string; onTimeMs?: (ms: number) => void; initialSeekMs?: number }
>(function AudioPlayer({ sessionId, onTimeMs, initialSeekMs }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [playing, setPlaying] = useState(false);
  const [timeMs, setTimeMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);

  useImperativeHandle(ref, () => ({
    seekToMs(ms: number) {
      const ws = wsRef.current;
      if (!ws) return;
      ws.setTime(ms / 1000);
      if (!ws.isPlaying()) void ws.play();
    },
  }));

  useEffect(() => {
    let cancelled = false;
    let ws: WaveSurfer | null = null;

    (async () => {
      const res = await fetch(`/api/sessions/${sessionId}/audio`);
      if (cancelled) return;
      if (res.status === 404) {
        setState("no-audio");
        return;
      }
      if (!res.ok) {
        setState("error");
        return;
      }
      const { url } = (await res.json()) as { url: string };

      const { default: WaveSurferCtor } = await import("wavesurfer.js");
      if (cancelled || !containerRef.current) return;

      ws = WaveSurferCtor.create({
        container: containerRef.current,
        url,
        height: 56,
        waveColor: "#b5dce6",
        progressColor: "#0f4c5c",
        cursorColor: "#c8881a",
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        normalize: true,
      });
      wsRef.current = ws;

      ws.on("ready", () => {
        setDurationMs(Math.round(ws!.getDuration() * 1000));
        setState("ready");
        // Deep-link from search results (?t=ms): position without autoplaying.
        if (initialSeekMs && initialSeekMs > 0) {
          ws!.setTime(initialSeekMs / 1000);
        }
      });
      ws.on("timeupdate", (t: number) => {
        const ms = Math.round(t * 1000);
        setTimeMs(ms);
        onTimeMs?.(ms);
      });
      ws.on("play", () => setPlaying(true));
      ws.on("pause", () => setPlaying(false));
      ws.on("finish", () => setPlaying(false));
      ws.on("error", () => setState("error"));
    })().catch(() => setState("error"));

    return () => {
      cancelled = true;
      ws?.destroy();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  if (state === "no-audio") {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs text-slate-400">
        Audio not retained for this session (private mode or text import).
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs text-slate-400">
        Audio playback unavailable.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={() => void wsRef.current?.playPause()}
        disabled={state !== "ready"}
        aria-label={playing ? "Pause" : "Play"}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-800 text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-50"
      >
        {state === "loading" ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : playing ? (
          <Pause className="h-5 w-5" />
        ) : (
          <Play className="ml-0.5 h-5 w-5" />
        )}
      </button>
      <div className="min-w-0 flex-1" ref={containerRef} />
      <span className="shrink-0 font-mono text-xs tabular-nums text-slate-500">
        {fmtMs(timeMs)} / {fmtMs(durationMs)}
      </span>
    </div>
  );
});
