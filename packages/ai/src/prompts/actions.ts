/** Action-item extraction template (MVP-04): specific, owner-attributed when inferable. */
export const ACTIONS_PROMPT_VERSION = "actions-v2";

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
    { "text": "specific, self-contained task", "owner": "responsible person", "dueHint": "deadline phrase if stated" }
  ]
}`,
    [
      "Rules:",
      "- Include every real commitment, assignment, or agreed next step.",
      "- Make each item specific and self-contained (mention the feature/component/number/date involved), not vague.",
      "- Set `owner` to the responsible person whenever the transcript makes it inferable — including when someone is told to do it or volunteers (e.g. 'X ভাই দেখাবে' / 'X will handle it') — not only when explicitly named as the assignee. Omit `owner` only if truly unclear.",
      "- Set `dueHint` only when a deadline/timeframe is stated.",
      "- When no specific person is responsible, omit the owner key entirely — never output a placeholder owner such as 'Unspecified', 'Team', 'Someone', or 'N/A'.",
      "- Deduplicate overlapping items. Return an empty items array if there are none.",
    ].join("\n"),
  ].join("\n\n");

  return { system, user: `Transcript:\n\n${input.transcript}` };
}
