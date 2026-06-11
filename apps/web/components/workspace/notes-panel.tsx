"use client";

import { Clock, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fmtMs, type WorkspaceNote } from "./types";

/** Notes tab: add (optionally time-anchored), edit-in-place, delete (MVP-06). */
export function NotesPanel({
  sessionId,
  notes: initialNotes,
  currentMs,
  onSeek,
}: {
  sessionId: string;
  notes: WorkspaceNote[];
  currentMs: number;
  onSeek: (ms: number) => void;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [draft, setDraft] = useState("");
  const [anchor, setAnchor] = useState(false);
  const [busy, setBusy] = useState(false);

  async function addNote() {
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    const res = await fetch(`/api/sessions/${sessionId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, anchorMs: anchor ? currentMs : null }),
    });
    setBusy(false);
    if (res.ok) {
      const { note } = (await res.json()) as { note: WorkspaceNote };
      setNotes((prev) => [...prev, note]);
      setDraft("");
    }
  }

  async function removeNote(id: string) {
    const prev = notes;
    setNotes((p) => p.filter((n) => n.id !== id));
    const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
    if (!res.ok) setNotes(prev);
  }

  return (
    <div className="space-y-4">
      {notes.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-400">
          Add your own notes alongside the transcript.
        </p>
      ) : (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li
              key={note.id}
              data-testid="note-row"
              className="group rounded-xl border border-slate-100 bg-slate-50/60 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {note.text}
                </p>
                <button
                  onClick={() => void removeNote(note.id)}
                  aria-label="Delete note"
                  className="hidden h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 group-hover:flex"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {note.anchorMs !== null && (
                <button
                  onClick={() => onSeek(note.anchorMs!)}
                  className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 font-mono text-xs text-primary-700 transition hover:bg-primary-100"
                >
                  <Clock className="h-3 w-3" />
                  {fmtMs(note.anchorMs)}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2 border-t border-slate-100 pt-4">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a note…"
          rows={2}
          data-testid="note-input"
          className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        />
        <div className="flex items-center justify-between gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-500">
            <input
              type="checkbox"
              checked={anchor}
              onChange={(e) => setAnchor(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-primary-700 focus:ring-primary-500"
            />
            Anchor at {fmtMs(currentMs)}
          </label>
          <Button size="sm" onClick={() => void addNote()} disabled={busy || !draft.trim()}>
            <Plus className="h-3.5 w-3.5" />
            Add note
          </Button>
        </div>
      </div>
    </div>
  );
}
