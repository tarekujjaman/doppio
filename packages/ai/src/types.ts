import { z } from "zod";

/** zod-validated LLM outputs (plan §6b) — parsing must never throw unhandled. */

export const SummarizeOutputSchema = z.object({
  overview: z.string().min(1),
  decisions: z.string().optional(),
  nextSteps: z.string().optional(),
  title: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1).max(6),
});
export type SummarizeOutput = z.infer<typeof SummarizeOutputSchema>;

export const ActionsOutputSchema = z.object({
  items: z.array(
    z.object({
      text: z.string().min(1),
      owner: z.string().optional(),
      dueHint: z.string().optional(),
    }),
  ),
});
export type ActionsOutput = z.infer<typeof ActionsOutputSchema>;

export interface AskCitation {
  segmentIdx: number;
  startMs: number;
}

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LLMCompletion {
  text: string;
  usage: LLMUsage;
  model: string;
}

/** Thin LLM abstraction — OpenAI in prod, mock in dev/tests. */
export interface LLMClient {
  readonly name: string;
  complete(input: { system: string; user: string; maxTokens?: number }): Promise<LLMCompletion>;
  embed(texts: string[]): Promise<number[][]>;
}

export type LLMProviderName = "mock" | "openai";
