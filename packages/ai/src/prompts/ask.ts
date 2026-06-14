/** Ask Doppio RAG template (MVP-10): grounded answers with [seg:N] citations. */
export const ASK_PROMPT_VERSION = "ask-v1";

export interface AskExcerpt {
  /** Number shown to the model — maps back to a chunk and its startMs. */
  n: number;
  text: string;
}

export interface AskHistoryTurn {
  role: "user" | "assistant";
  text: string;
}

export function buildAskPrompt(input: {
  excerpts: AskExcerpt[];
  question: string;
  history?: AskHistoryTurn[];
}): { system: string; user: string } {
  const system = [
    "You answer questions about a recorded session using ONLY the numbered transcript excerpts provided.",
    "Cite the excerpts you used inline with [seg:N] markers (e.g. [seg:2]). Every factual claim needs at least one citation.",
    "Answer in the same language as the question (Bangla question → Bangla answer, English → English).",
    'If the excerpts do not contain the answer, say so honestly — never invent details.',
    "Keep answers concise and direct.",
  ].join("\n");

  const excerptBlock = input.excerpts.map((e) => `[${e.n}] ${e.text}`).join("\n\n");
  const historyBlock =
    input.history && input.history.length > 0
      ? `\n\nConversation so far:\n${input.history
          .map((h) => `${h.role === "user" ? "Q" : "A"}: ${h.text}`)
          .join("\n")}`
      : "";

  return {
    system,
    user: `Transcript excerpts:\n\n${excerptBlock}${historyBlock}\n\nQuestion: ${input.question}`,
  };
}

export interface GlobalAskExcerpt {
  n: number;
  text: string;
  sessionTitle: string;
  kind: string; // transcript | summary | note | action
  startMs: number | null;
}

function ts(ms: number | null): string | null {
  if (ms == null) return null;
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function excerptLabel(e: GlobalAskExcerpt): string {
  const time = ts(e.startMs);
  switch (e.kind) {
    case "summary":
      return `Summary of "${e.sessionTitle}"`;
    case "note":
      return `Note in "${e.sessionTitle}"${time ? ` · ${time}` : ""}`;
    case "action":
      return `Action item in "${e.sessionTitle}"`;
    default:
      return time ? `${e.sessionTitle} · ${time}` : e.sessionTitle;
  }
}

/**
 * Ask Doppio — global memory chat. Answers grounded in the user's WHOLE memory
 * (transcripts + summaries + notes + actions across all their sessions). Each excerpt
 * is labeled with its source session so the model can attribute, and [seg:N] markers
 * map back to a chunk carrying its sessionId + timestamp.
 */
export function buildGlobalAskPrompt(input: {
  excerpts: GlobalAskExcerpt[];
  question: string;
  history?: AskHistoryTurn[];
}): { system: string; user: string } {
  const system = [
    "You are Doppio — the user's personal AI second brain. Answer using ONLY the user's own memory excerpts below, drawn from their recorded sessions' transcripts, summaries, notes, and action items.",
    "Cite the excerpts you used inline with [seg:N] markers (e.g. [seg:2]). Every factual claim needs at least one citation.",
    "When useful, mention which session something came from — each excerpt is labeled with its source.",
    "Answer in the same language as the question (Bangla question → Bangla answer, English → English).",
    "If the excerpts do not contain the answer, say so honestly — never invent details.",
    "Be concise and direct.",
  ].join("\n");

  const excerptBlock = input.excerpts.map((e) => `[${e.n}] (${excerptLabel(e)})\n${e.text}`).join("\n\n");
  const historyBlock =
    input.history && input.history.length > 0
      ? `\n\nConversation so far:\n${input.history
          .map((h) => `${h.role === "user" ? "Q" : "A"}: ${h.text}`)
          .join("\n")}`
      : "";

  return {
    system,
    user: `Excerpts from your memory:\n\n${excerptBlock}${historyBlock}\n\nQuestion: ${input.question}`,
  };
}

/** Parses [seg:N] citation markers out of a model answer. */
export function extractCitations(answer: string): number[] {
  const found = new Set<number>();
  for (const m of answer.matchAll(/\[seg:(\d+)\]/g)) {
    found.add(Number(m[1]));
  }
  return [...found].sort((a, b) => a - b);
}
