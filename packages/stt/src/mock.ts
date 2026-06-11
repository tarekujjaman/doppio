import { FIXTURES } from "./fixtures";
import type { SttInput, SttProvider, SttResult } from "./types";

/**
 * Zero-cost provider for dev/tests. Picks a fixture by languageHint,
 * or by filename convention: contains "bangla"/"bn" → bn, "mixed"/"switch" → mixed, else en.
 */
export class MockSttProvider implements SttProvider {
  readonly name = "mock";

  async transcribeFile(input: SttInput): Promise<SttResult> {
    const file = input.audio.filename.toLowerCase();
    let key: keyof typeof FIXTURES;
    if (input.languageHint === "bn") key = "bn";
    else if (file.includes("mixed") || file.includes("switch")) key = "mixed";
    else if (file.includes("bangla") || file.includes("bn")) key = "bn";
    else key = "en";

    const fixture = FIXTURES[key];
    return {
      language: fixture.language,
      segments: fixture.segments.map((s) => ({ ...s })),
    };
  }
}
