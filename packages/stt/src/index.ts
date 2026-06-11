import { MockSttProvider } from "./mock";
import { OpenAiSttProvider } from "./openai";
import { TwinMindSttProvider } from "./twinmind";
import type { SttProvider, SttProviderName } from "./types";

export * from "./types";
export * from "./fixtures";
export { MockSttProvider } from "./mock";
export { OpenAiSttProvider } from "./openai";
export { TwinMindSttProvider } from "./twinmind";

export interface SttEnv {
  STT_PROVIDER?: string;
  STT_MODEL?: string;
  OPENAI_API_KEY?: string;
  TWINMIND_API_KEY?: string;
  TWINMIND_API_BASE?: string;
}

/** Selected via STT_PROVIDER env (mock | twinmind | openai). */
export function createSttProvider(env: SttEnv = process.env as SttEnv): SttProvider {
  const name = (env.STT_PROVIDER ?? "mock") as SttProviderName;
  switch (name) {
    case "mock":
      return new MockSttProvider();
    case "twinmind": {
      if (!env.TWINMIND_API_KEY) throw new Error("TWINMIND_API_KEY is required for STT_PROVIDER=twinmind");
      return new TwinMindSttProvider({ apiKey: env.TWINMIND_API_KEY, apiBase: env.TWINMIND_API_BASE });
    }
    case "openai": {
      if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for STT_PROVIDER=openai");
      return new OpenAiSttProvider({ apiKey: env.OPENAI_API_KEY, model: env.STT_MODEL ?? "whisper-1" });
    }
    default:
      throw new Error(`Unknown STT provider "${name as string}"`);
  }
}
