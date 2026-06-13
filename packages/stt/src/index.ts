import { MockSttProvider } from "./mock";
import { OpenAiSttProvider } from "./openai";
import { SttFormatError, TwinMindSttProvider } from "./twinmind";
import type { SttInput, SttProvider, SttProviderName, SttResult } from "./types";

export * from "./types";
export * from "./fixtures";
export { MockSttProvider } from "./mock";
export { OpenAiSttProvider } from "./openai";
export { TwinMindSttProvider, SttFormatError } from "./twinmind";

export interface SttEnv {
  STT_PROVIDER?: string;
  STT_MODEL?: string;
  TWINMIND_MODEL?: string;
  OPENAI_API_KEY?: string;
  TWINMIND_API_KEY?: string;
  TWINMIND_API_BASE?: string;
}

/**
 * Primary provider with a fallback used only when the primary rejects the audio
 * format (TwinMind doesn't accept webm; browser recordings fall back to Whisper).
 */
class FallbackSttProvider implements SttProvider {
  readonly name: string;
  constructor(
    private readonly primary: SttProvider,
    private readonly fallback: SttProvider,
  ) {
    this.name = `${primary.name}+${fallback.name}`;
  }

  async transcribeFile(input: SttInput): Promise<SttResult> {
    try {
      return await this.primary.transcribeFile(input);
    } catch (err) {
      if (err instanceof SttFormatError) {
        return this.fallback.transcribeFile(input);
      }
      throw err;
    }
  }
}

/** Selected via STT_PROVIDER env (twinmind | openai | mock). */
export function createSttProvider(env: SttEnv = process.env as SttEnv): SttProvider {
  const name = (env.STT_PROVIDER ?? "mock") as SttProviderName;
  switch (name) {
    case "mock":
      return new MockSttProvider();
    case "twinmind": {
      if (!env.TWINMIND_API_KEY) {
        throw new Error("TWINMIND_API_KEY is required for STT_PROVIDER=twinmind");
      }
      const twinmind = new TwinMindSttProvider({
        apiKey: env.TWINMIND_API_KEY,
        apiBase: env.TWINMIND_API_BASE,
        model: env.TWINMIND_MODEL ?? "ear-3-pro",
      });
      // Whisper handles formats TwinMind can't (webm recordings), if a key exists.
      if (env.OPENAI_API_KEY) {
        return new FallbackSttProvider(
          twinmind,
          new OpenAiSttProvider({ apiKey: env.OPENAI_API_KEY, model: "whisper-1" }),
        );
      }
      return twinmind;
    }
    case "openai": {
      if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for STT_PROVIDER=openai");
      return new OpenAiSttProvider({ apiKey: env.OPENAI_API_KEY, model: env.STT_MODEL ?? "whisper-1" });
    }
    default:
      throw new Error(`Unknown STT provider "${name as string}"`);
  }
}
