"use client";

import { Loader2, SendHorizonal, Sparkles } from "lucide-react";
import { Fragment, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { fmtMs } from "./types";

interface Citation {
  segmentIdx: number;
  startMs: number;
}

interface AskMessage {
  role: "user" | "assistant";
  text: string;
  citations?: Citation[];
}

/** Renders answer text, turning [seg:N] markers into clickable timestamp chips. */
function AnswerText({
  text,
  citations,
  onSeek,
}: {
  text: string;
  citations?: Citation[];
  onSeek: (ms: number) => void;
}) {
  const byIdx = new Map((citations ?? []).map((c) => [c.segmentIdx, c.startMs]));
  const parts = text.split(/(\[seg:\d+\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\[seg:(\d+)\]$/);
        if (!m) return <Fragment key={i}>{part}</Fragment>;
        const idx = Number(m[1]);
        const startMs = byIdx.get(idx);
        if (startMs === undefined) return null; // streaming: chips appear once resolved
        return (
          <button
            key={i}
            onClick={() => onSeek(startMs)}
            data-testid="ask-citation"
            className="mx-0.5 inline-flex translate-y-[-1px] items-center rounded-full bg-primary-50 px-1.5 py-0.5 font-mono text-[11px] text-primary-700 transition hover:bg-primary-100"
          >
            ▶ {fmtMs(startMs)}
          </button>
        );
      })}
    </>
  );
}

/** Ask Doppio chat (MVP-10/11): SSE streaming, grounded answers, follow-ups. */
export function AskPanel({
  sessionId,
  ready,
  onSeek,
}: {
  sessionId: string;
  ready: boolean;
  onSeek: (ms: number) => void;
}) {
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadRef = useRef<string | null>(null);

  async function send() {
    const question = input.trim();
    if (!question || busy) return;
    setInput("");
    setError(null);
    setBusy(true);
    setMessages((prev) => [...prev, { role: "user", text: question }, { role: "assistant", text: "" }]);

    try {
      const res = await fetch(`/api/sessions/${sessionId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, threadId: threadRef.current ?? undefined }),
      });

      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { error?: { message: string } } | null;
        throw new Error(body?.error?.message ?? `Ask failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const apply = (event: string, data: Record<string, unknown>) => {
        if (event === "meta") threadRef.current = String(data.threadId);
        if (event === "delta") {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1]!;
            next[next.length - 1] = { ...last, text: last.text + String(data.text) };
            return next;
          });
        }
        if (event === "done") {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1]!;
            next[next.length - 1] = { ...last, citations: data.citations as Citation[] };
            return next;
          });
        }
        if (event === "error") throw new Error(String(data.message));
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          let event = "message";
          let data = "";
          for (const line of frame.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            if (line.startsWith("data:")) data += line.slice(5).trim();
          }
          if (data) apply(event, JSON.parse(data) as Record<string, unknown>);
        }
      }
    } catch (err) {
      setMessages((prev) => prev.slice(0, -1)); // drop the empty assistant bubble
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <p className="py-6 text-center text-sm text-slate-400">
        Ask becomes available once processing finishes.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {messages.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <Sparkles className="h-6 w-6 text-accent-500" />
          <p className="text-sm text-slate-500">
            Ask anything about this session — answers cite the exact moment.
          </p>
        </div>
      )}

      <div className="max-h-[45vh] space-y-3 overflow-y-auto">
        {messages.map((msg, i) => (
          <div
            key={i}
            data-testid={msg.role === "assistant" ? "ask-answer" : "ask-question"}
            className={
              msg.role === "user"
                ? "ml-6 rounded-2xl rounded-br-md bg-primary-800 px-4 py-2.5 text-sm leading-relaxed text-white"
                : "mr-2 rounded-2xl rounded-bl-md bg-slate-100 px-4 py-2.5 text-sm leading-relaxed text-slate-800"
            }
          >
            {msg.role === "assistant" ? (
              msg.text === "" && busy ? (
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              ) : (
                <AnswerText text={msg.text} citations={msg.citations} onSeek={onSeek} />
              )
            ) : (
              msg.text
            )}
          </div>
        ))}
      </div>

      {error && (
        <p className="rounded-lg border border-red-100 bg-red-50 p-2.5 text-xs text-red-700">
          {error}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          data-testid="ask-input"
          className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm transition-colors placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        />
        <Button type="submit" disabled={busy || !input.trim()} aria-label="Send question">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
