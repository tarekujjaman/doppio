import { detectLanguage } from "@doppio/core";
import type { LLMClient, LLMCompletion } from "./types";

/**
 * Deterministic zero-cost LLM for dev/tests.
 * Structured output (summaries/actions) is always English (matches the product
 * rule "summary in English, transcript in any language"); Ask answers mirror the
 * question's language.
 */
export class MockLLMClient implements LLMClient {
  readonly name = "mock";

  async complete(input: {
    system: string;
    user: string;
    json?: boolean;
  }): Promise<LLMCompletion> {
    const lang = detectLanguage(input.user);
    const wantsJson = input.json ?? /json/i.test(input.system);

    let text: string;
    if (wantsJson) {
      // Summaries/action items are always English.
      text = JSON.stringify({
        overview: "Mock overview of the session.",
        decisions: "Mock decision.",
        nextSteps: "Mock next step.",
        title: "Mock session title",
        tags: ["mock", "demo", "test"],
        items: [{ text: "Mock action item", owner: "Alex" }],
      });
    } else {
      // Ask answers mirror the question's language.
      text =
        lang === "en"
          ? "Mock answer grounded in the provided context. [seg:0]"
          : "প্রদত্ত প্রসঙ্গের ভিত্তিতে মক উত্তর। [seg:0]";
    }

    return {
      text,
      usage: { inputTokens: Math.ceil(input.user.length / 4), outputTokens: 64 },
      model: "mock",
    };
  }

  async *streamComplete(input: { system: string; user: string }): AsyncIterable<string> {
    const { text } = await this.complete({ ...input, json: false });
    for (const word of text.split(/(?<=\s)/)) {
      yield word;
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    // Deterministic pseudo-embeddings: stable per text, unit-ish scale, 1536 dims.
    return texts.map((t) => {
      const v = new Array<number>(1536).fill(0);
      for (let i = 0; i < t.length; i++) {
        const idx = (t.charCodeAt(i) * 31 + i) % 1536;
        v[idx] = (v[idx] ?? 0) + 1;
      }
      const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
      return v.map((x) => x / norm);
    });
  }
}
