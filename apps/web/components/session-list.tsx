import { FileAudio } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

const STATUS_TONE: Record<string, "success" | "danger" | "warning" | "neutral" | "info"> = {
  READY: "success",
  FAILED: "danger",
  TRANSCRIBING: "warning",
  SUMMARIZING: "warning",
  UPLOADED: "neutral",
  RECORDING: "info",
};

const STATUS_LABEL: Record<string, string> = {
  READY: "Ready",
  FAILED: "Failed",
  TRANSCRIBING: "Transcribing",
  SUMMARIZING: "Summarizing",
  UPLOADED: "Queued",
  RECORDING: "Recording",
};

export interface SessionRow {
  id: string;
  title: string;
  status: string;
  language: string | null;
  durationSec: number | null;
  createdAt: Date;
}

function formatMeta(s: SessionRow): string {
  const parts = [
    s.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
  ];
  if (s.durationSec) parts.push(`${Math.max(1, Math.ceil(s.durationSec / 60))} min`);
  if (s.language) parts.push(s.language === "bn" ? "Bangla" : s.language === "mixed" ? "Mixed" : s.language.toUpperCase());
  return parts.join(" · ");
}

export function SessionList({
  sessions,
  emptyHint,
}: {
  sessions: SessionRow[];
  emptyHint?: string;
}) {
  if (sessions.length === 0) {
    return (
      <Card className="border-dashed shadow-none">
        <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
          <FileAudio className="h-8 w-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">No sessions yet</p>
          <p className="text-sm text-slate-400">{emptyHint ?? "Upload audio to get started."}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="divide-y divide-slate-100 overflow-hidden">
      {sessions.map((s) => (
        <Link
          key={s.id}
          href={`/sessions/${s.id}`}
          data-testid="session-row"
          className="flex items-center gap-4 px-5 py-4 transition hover:bg-slate-50/80"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
            <FileAudio className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-slate-900">{s.title}</p>
            <p className="mt-0.5 text-xs text-slate-500">{formatMeta(s)}</p>
          </div>
          <Badge tone={STATUS_TONE[s.status] ?? "neutral"}>
            {STATUS_LABEL[s.status] ?? s.status}
          </Badge>
        </Link>
      ))}
    </Card>
  );
}
