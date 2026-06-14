/**
 * Summary + title + tags template (MVP-01/02/07). Versioned file, not inline strings.
 * Product rule: summaries are always English regardless of transcript language
 * (the pipeline passes targetLanguage="en"); the transcript stays in its own
 * language. The "bn" branch is kept for flexibility but is currently unused.
 */
export const SUMMARIZE_PROMPT_VERSION = "summarize-v3-detail-en";

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
    "You write thorough, well-structured notes from meeting/lecture transcripts.",
    languageRule,
    "Respond with a single JSON object, no markdown fences, matching exactly:",
    `{
  "title": "short descriptive session title (max 70 chars)",
  "overview": "2-4 sentence high-level summary of what was discussed",
  "detail": "a DETAILED markdown write-up (see rules below)",
  "decisions": "key decisions made, or omit if none",
  "nextSteps": "agreed next steps, or omit if none",
  "tags": ["3-5 short lowercase topic tags"]
}`,
    [
      "Rules for the `detail` field (this is the most important field):",
      "- It is a single markdown string.",
      "- Start with an `## Overview` section: a few bullets covering participants/speakers (by name when stated) and the most critical outcomes.",
      "- Then ONE `## ` section per major topic actually discussed (e.g. each feature, workstream, or agenda item). Derive the sections from the transcript — do not force a fixed set.",
      "- Under each section, use bullets and indented sub-bullets that capture concrete specifics: names, dates, version/milestone labels, numbers, components, and decisions — not vague generalities.",
      "- Be comprehensive: a reader who missed the meeting should understand it fully from `detail` alone.",
      "- Keep `overview` short; put the depth in `detail`.",
    ].join("\n"),
    "Base everything strictly on the transcript. Never invent facts, names, dates, or numbers; if something was unclear or not attributed, say so rather than guessing.",
  ].join("\n\n");

  return { system, user: `Transcript:\n\n${input.transcript}` };
}
