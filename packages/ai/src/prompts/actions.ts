/** Action-item extraction template (MVP-04): deduped, owner/due only when stated. */
export const ACTIONS_PROMPT_VERSION = "actions-v1";

import type { TargetLanguage } from "./summarize";

export function buildActionsPrompt(input: {
  transcript: string;
  targetLanguage: TargetLanguage;
}): { system: string; user: string } {
  const languageRule =
    input.targetLanguage === "bn"
      ? "Write item text in natural Bangla, preserving English technical terms where they were spoken."
      : "Write item text in clear English.";

  const system = [
    "You extract action items (to-dos) from a meeting/lecture transcript.",
    languageRule,
    "Respond with a single JSON object, no markdown, matching exactly:",
    `{
  "items": [
    { "text": "what needs to be done", "owner": "person name if stated", "dueHint": "deadline phrase if stated" }
  ]
}`,
    "Rules: only include real commitments or assigned tasks from the transcript. Deduplicate overlapping items. Omit owner/dueHint when not stated. Return an empty items array if there are none.",
  ].join("\n\n");

  return { system, user: `Transcript:\n\n${input.transcript}` };
}
