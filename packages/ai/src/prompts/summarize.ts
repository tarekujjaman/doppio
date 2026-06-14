/**
 * Summary + title + tags template (MVP-01/02/07). Versioned file, not inline strings.
 * Product rule: summaries are always English regardless of transcript language
 * (the pipeline passes targetLanguage="en"); the transcript stays in its own
 * language. The "bn" branch is kept for flexibility but is currently unused.
 */
export const SUMMARIZE_PROMPT_VERSION = "summarize-v2-en";

export type TargetLanguage = "bn" | "en";

export function buildSummarizePrompt(input: {
  transcript: string;
  targetLanguage: TargetLanguage;
}): { system: string; user: string } {
  const languageRule =
    input.targetLanguage === "bn"
      ? "Write ALL output values in fluent, natural Bangla (বাংলা). Keep widely-used English technical terms as-is inside Bangla sentences when that is how people actually speak."
      : "Write all output values in clear, professional English.";

  const system = [
    "You summarize meeting/lecture transcripts into structured JSON notes.",
    languageRule,
    "Respond with a single JSON object, no markdown, matching exactly:",
    `{
  "title": "short descriptive session title (max 70 chars)",
  "overview": "2-4 sentence summary of what was discussed",
  "decisions": "decisions that were made, or omit if none",
  "nextSteps": "agreed next steps, or omit if none",
  "tags": ["3-5 short lowercase topic tags"]
}`,
    "Base everything strictly on the transcript. Never invent facts, names, or dates.",
  ].join("\n\n");

  return { system, user: `Transcript:\n\n${input.transcript}` };
}
