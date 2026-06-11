import type { LanguageTag } from "./types";

const BANGLA_RANGE = /[ঀ-৿]/;
const LATIN_WORD = /[A-Za-z]{2,}/;

/** Cheap script-based language sniff for routing prompts/mocks (not a quality gate). */
export function detectLanguage(text: string): LanguageTag {
  const hasBangla = BANGLA_RANGE.test(text);
  const hasEnglish = LATIN_WORD.test(text);
  if (hasBangla && hasEnglish) return "mixed";
  if (hasBangla) return "bn";
  return "en";
}
