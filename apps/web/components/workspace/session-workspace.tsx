"use client";

import { ArrowLeft, Check, FileDown, Loader2, Pencil, Share2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ActionItemsPanel } from "./action-items-panel";
import { AskPanel } from "./ask-panel";
import { AudioPlayer, type AudioPlayerHandle } from "./audio-player";
import { NotesPanel } from "./notes-panel";
import { SharePanel } from "./share-panel";
import { SummaryPanel } from "./summary-panel";
import { TranscriptView } from "./transcript-view";
import type { WorkspaceSession, WorkspaceSummary } from "./types";

const PROCESSING = ["UPLOADED", "TRANSCRIBING", "SUMMARIZING", "RECORDING"];
type Tab = "summary" | "actions" | "notes" | "ask";

export function SessionWorkspace({
  initial,
  initialSeekMs,
}: {
  initial: WorkspaceSession;
  initialSeekMs?: number;
}) {
  const router = useRouter();
  const [session, setSession] = useState(initial);
  const [tab, setTab] = useState<Tab>("summary");
  const [currentMs, setCurrentMs] = useState(initialSeekMs ?? 0);
  const playerRef = useRef<AudioPlayerHandle>(null);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(initial.title);
  const [showShare, setShowShare] = useState(false);

  const processing = PROCESSING.includes(session.status);

  // Live status while the pipeline runs (M2/M3 status walk).
  useEffect(() => {
    if (!processing) return;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/sessions/${session.id}`);
      if (!res.ok) return;
      const { session: fresh } = (await res.json()) as { session: WorkspaceSession };
      setSession(fresh);
      setTitleDraft(fresh.title);
    }, 2500);
    return () => clearInterval(timer);
  }, [processing, session.id]);

  const seek = useCallback((ms: number) => {
    playerRef.current?.seekToMs(ms);
    setCurrentMs(ms);
  }, []);

  async function saveTitle() {
    const title = titleDraft.trim();
    setEditingTitle(false);
    if (!title || title === session.title) {
      setTitleDraft(session.title);
      return;
    }
    const prev = session.title;
    setSession((s) => ({ ...s, title }));
    const res = await fetch(`/api/sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) {
      setSession((s) => ({ ...s, title: prev }));
      setTitleDraft(prev);
    }
  }

  async function deleteSession() {
    if (!confirm("Delete this session permanently? This cannot be undone.")) return;
    const res = await fetch(`/api/sessions/${session.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/sessions");
      router.refresh();
    }
  }

  const tabs: { key: Tab; label: string; disabled?: boolean }[] = [
    { key: "summary", label: "Summary" },
    { key: "actions", label: `Actions${session.actionItems.length ? ` (${session.actionItems.length})` : ""}` },
    { key: "notes", label: `Notes${session.notes.length ? ` (${session.notes.length})` : ""}` },
    { key: "ask", label: "Ask" },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/sessions"
          className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All sessions
        </Link>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          {editingTitle ? (
            <div className="flex max-w-xl flex-1 items-center gap-2">
              <Input
                autoFocus
                value={titleDraft}
                data-testid="title-input"
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void saveTitle();
                  if (e.key === "Escape") {
                    setEditingTitle(false);
                    setTitleDraft(session.title);
                  }
                }}
                className="h-10 text-lg font-semibold"
              />
              <button
                onClick={() => void saveTitle()}
                aria-label="Save title"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-800 text-white hover:bg-primary-700"
              >
                <Check className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <h1
              className="group flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900"
              data-testid="session-title"
            >
              {session.title}
              <button
                onClick={() => setEditingTitle(true)}
                aria-label="Rename session"
                data-testid="rename-button"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </h1>
          )}

          <Badge tone={session.status === "READY" ? "success" : processing ? "warning" : "danger"}>
            {processing && <Loader2 className="h-3 w-3 animate-spin" />}
            {session.status === "READY" ? "Ready" : session.status}
          </Badge>

          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setShowShare((s) => !s)}
              aria-label="Share session"
              data-testid="share-button"
              title="Share"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition",
                showShare
                  ? "bg-primary-50 text-primary-700"
                  : "text-slate-400 hover:bg-slate-100 hover:text-slate-700",
              )}
            >
              <Share2 className="h-4 w-4" />
            </button>
            <a
              href={`/api/sessions/${session.id}/export?format=pdf`}
              aria-label="Export as PDF"
              title="Export PDF"
              className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <FileDown className="h-4 w-4" />
              PDF
            </a>
            <a
              href={`/api/sessions/${session.id}/export?format=docx`}
              aria-label="Export as Word document"
              title="Export DOCX"
              className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <FileDown className="h-4 w-4" />
              DOCX
            </a>
            <button
              onClick={() => void deleteSession()}
              aria-label="Delete session"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <p className="mt-1 text-sm text-slate-500">
          {new Date(session.createdAt).toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
          {session.durationSec
            ? ` · ${Math.max(1, Math.ceil(session.durationSec / 60))} min`
            : ""}
          {session.language
            ? ` · ${session.language === "bn" ? "Bangla" : session.language === "mixed" ? "Mixed" : session.language.toUpperCase()}`
            : ""}
        </p>

        {session.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {session.tags.map((tag) => (
              <Badge key={tag} tone="brand">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {showShare && <SharePanel sessionId={session.id} />}

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_400px]">
        {/* Transcript (with the player only when audio was retained) */}
        <Card>
          <CardContent className="space-y-5 p-5">
            {session.hasAudio && (
              <AudioPlayer
                ref={playerRef}
                sessionId={session.id}
                onTimeMs={setCurrentMs}
                initialSeekMs={initialSeekMs}
              />
            )}
            <TranscriptView segments={session.transcript} currentMs={currentMs} onSeek={seek} />
          </CardContent>
        </Card>

        {/* Tabs */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1">
              {tabs.map((tabDef) => (
                <button
                  key={tabDef.key}
                  onClick={() => !tabDef.disabled && setTab(tabDef.key)}
                  disabled={tabDef.disabled}
                  title={tabDef.disabled ? "Coming soon" : undefined}
                  className={cn(
                    "flex-1 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors",
                    tab === tabDef.key
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700",
                    tabDef.disabled && "cursor-not-allowed opacity-40",
                  )}
                >
                  {tabDef.label}
                </button>
              ))}
            </div>

            {tab === "summary" && (
              <SummaryPanel
                sessionId={session.id}
                summary={session.summary}
                processing={processing}
                onUpdated={(summary: WorkspaceSummary) => setSession((s) => ({ ...s, summary }))}
              />
            )}
            {tab === "actions" && (
              <ActionItemsPanel items={session.actionItems} processing={processing} />
            )}
            {tab === "notes" && (
              <NotesPanel
                sessionId={session.id}
                notes={session.notes}
                currentMs={currentMs}
                onSeek={seek}
              />
            )}
            {tab === "ask" && (
              <AskPanel sessionId={session.id} ready={session.status === "READY"} onSeek={seek} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
