"use client";

import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { fmtMs, type WorkspaceSegment } from "./types";

/** Click-to-seek transcript with active-segment highlight + auto-scroll (MVP-30). */
export function TranscriptView({
  segments,
  currentMs,
  onSeek,
}: {
  segments: WorkspaceSegment[];
  currentMs: number;
  onSeek: (ms: number) => void;
}) {
  const activeIdx = useMemo(() => {
    let active = -1;
    for (const seg of segments) {
      if (seg.startMs <= currentMs) active = seg.idx;
      else break;
    }
    return active;
  }, [segments, currentMs]);

  const activeRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIdx]);

  if (segments.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-400">No transcript available.</p>;
  }

  return (
    <ol className="max-h-[60vh] space-y-1 overflow-y-auto pr-1">
      {segments.map((seg) => {
        const active = seg.idx === activeIdx;
        return (
          <li key={seg.id} ref={active ? activeRef : undefined}>
            <button
              onClick={() => onSeek(seg.startMs)}
              data-testid="transcript-segment"
              className={cn(
                "group flex w-full gap-4 rounded-xl px-3 py-2.5 text-left transition-colors",
                active ? "bg-primary-50 ring-1 ring-inset ring-primary-200" : "hover:bg-slate-50",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 shrink-0 font-mono text-xs tabular-nums",
                  active ? "text-primary-700" : "text-slate-400 group-hover:text-primary-600",
                )}
              >
                {fmtMs(seg.startMs)}
              </span>
              <span className="min-w-0">
                {seg.speaker && (
                  <span className="mr-2 text-xs font-semibold text-accent-700">{seg.speaker}</span>
                )}
                <span
                  className={cn(
                    "text-[15px] leading-relaxed",
                    active ? "text-slate-900" : "text-slate-700",
                  )}
                >
                  {seg.text}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
