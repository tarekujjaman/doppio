import { MockLLMClient } from "./mock";
import type { LLMClient, LLMProviderName } from "./types";

export * from "./types";
export { MockLLMClient } from "./mock";

/** Selected via LLM_PROVIDER env (mock | openai). */
export function createLLMClient(name: LLMProviderName = "mock"): LLMClient {
  switch (name) {
    case "mock":
      return new MockLLMClient();
    case "openai":
      // Implemented in M3 (AI pipeline milestone).
      throw new Error(`LLM provider "openai" not implemented yet — use LLM_PROVIDER=mock`);
    default:
      throw new Error(`Unknown LLM provider "${name as string}"`);
  }
}
