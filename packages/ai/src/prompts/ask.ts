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

/** Parses [seg:N] citation markers out of a model answer. */
export function extractCitations(answer: string): number[] {
  const found = new Set<number>();
  for (const m of answer.matchAll(/\[seg:(\d+)\]/g)) {
    found.add(Number(m[1]));
  }
  return [...found].sort((a, b) => a - b);
}
