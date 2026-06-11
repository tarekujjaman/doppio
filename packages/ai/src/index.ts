import { MockLLMClient } from "./mock";
import { OpenAiLLMClient } from "./openai";
import type { LLMClient, LLMProviderName } from "./types";

export * from "./types";
export * from "./parse";
export * from "./prompts/summarize";
export * from "./prompts/actions";
export { MockLLMClient } from "./mock";
export { OpenAiLLMClient } from "./openai";

export interface LLMEnv {
  LLM_PROVIDER?: string;
  LLM_MODEL?: string;
  EMBED_MODEL?: string;
  OPENAI_API_KEY?: string;
}

/** Selected via LLM_PROVIDER env (mock | openai). */
export function createLLMClient(env: LLMEnv = process.env as LLMEnv): LLMClient {
  const name = (env.LLM_PROVIDER ?? "mock") as LLMProviderName;
  switch (name) {
    case "mock":
      return new MockLLMClient();
    case "openai": {
      if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for LLM_PROVIDER=openai");
      return new OpenAiLLMClient({
        apiKey: env.OPENAI_API_KEY,
        model: env.LLM_MODEL ?? "gpt-4o-mini",
        embedModel: env.EMBED_MODEL ?? "text-embedding-3-small",
      });
    }
    default:
      throw new Error(`Unknown LLM provider "${name as string}"`);
  }
}
