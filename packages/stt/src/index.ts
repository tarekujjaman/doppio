import { MockSttProvider } from "./mock";
import type { SttProvider, SttProviderName } from "./types";

export * from "./types";
export * from "./fixtures";
export { MockSttProvider } from "./mock";

/** Selected via STT_PROVIDER env (mock | twinmind | openai). */
export function createSttProvider(name: SttProviderName = "mock"): SttProvider {
  switch (name) {
    case "mock":
      return new MockSttProvider();
    case "twinmind":
    case "openai":
      // Implemented in M2 (upload→transcribe milestone).
      throw new Error(`STT provider "${name}" not implemented yet — use STT_PROVIDER=mock`);
    default:
      throw new Error(`Unknown STT provider "${name as string}"`);
  }
}
