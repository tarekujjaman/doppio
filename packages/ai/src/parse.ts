import type { z } from "zod";

/**
 * Defensive LLM-output parsing (M3 DoD: "zod parsing never throws unhandled").
 * Strips code fences, extracts the outermost JSON object, validates with zod.
 * Returns null on any failure — callers decide how to degrade.
 */
export function safeParseLLMJson<T>(raw: string, schema: z.ZodType<T>): T | null {
  const candidates: string[] = [];

  const trimmed = raw.trim();
  candidates.push(trimmed);

  // ```json ... ``` fences
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) candidates.push(fence[1].trim());

  // Outermost { ... } block (models sometimes prepend prose)
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) candidates.push(trimmed.slice(first, last + 1));

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      const result = schema.safeParse(parsed);
      if (result.success) return result.data;
    } catch {
      // try next candidate
    }
  }
  return null;
}
