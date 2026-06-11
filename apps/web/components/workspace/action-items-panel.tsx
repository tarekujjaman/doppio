"use client";

import { Check, Pencil } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { WorkspaceActionItem } from "./types";

/** Action items tab: optimistic check-off + inline edit (MVP-05). */
export function ActionItemsPanel({
  items: initialItems,
  processing,
}: {
  items: WorkspaceActionItem[];
  processing: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  async function toggle(item: WorkspaceActionItem) {
    const next = !item.done;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: next } : i)));
    const res = await fetch(`/api/action-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: next }),
    });
    if (!res.ok) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: !next } : i)));
    }
  }

  async function saveEdit(item: WorkspaceActionItem) {
    const text = draft.trim();
    setEditingId(null);
    if (!text || text === item.text) return;
    const prev = item.text;
    setItems((p) => p.map((i) => (i.id === item.id ? { ...i, text } : i)));
    const res = await fetch(`/api/action-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      setItems((p) => p.map((i) => (i.id === item.id ? { ...i, text: prev } : i)));
    }
  }

  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-slate-400">
        {processing ? "Extracting action items…" : "No action items found in this session."}
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item.id} className="group flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-slate-50">
          <button
            onClick={() => void toggle(item)}
            data-testid="action-toggle"
            aria-label={item.done ? "Mark as not done" : "Mark as done"}
            className={cn(
              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
              item.done
                ? "border-primary-700 bg-primary-700 text-white"
                : "border-slate-300 bg-white hover:border-primary-500",
            )}
          >
            {item.done && <Check className="h-3.5 w-3.5" />}
          </button>

          {editingId === item.id ? (
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => void saveEdit(item)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void saveEdit(item);
                if (e.key === "Escape") setEditingId(null);
              }}
              className="h-8 text-sm"
            />
          ) : (
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-sm leading-snug",
                  item.done ? "text-slate-400 line-through" : "text-slate-700",
                )}
              >
                {item.text}
              </p>
              {(item.owner || item.dueHint) && (
                <p className="mt-0.5 text-xs text-slate-400">
                  {[item.owner, item.dueHint].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          )}

          {editingId !== item.id && (
            <button
              onClick={() => {
                setEditingId(item.id);
                setDraft(item.text);
              }}
              aria-label="Edit action item"
              className="mt-0.5 hidden h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-600 group-hover:flex"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
