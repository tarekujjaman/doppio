import { describe, expect, it } from "vitest";
import { createSttProvider } from "./index";

const audio = (filename: string) => ({
  data: new Uint8Array([0]),
  filename,
  contentType: "audio/mpeg",
});

describe("MockSttProvider", () => {
  const provider = createSttProvider({ STT_PROVIDER: "mock" });

  it("returns ordered, gapless-indexed Bangla segments for bn hint", async () => {
    const r = await provider.transcribeFile({ audio: audio("lecture.mp3"), languageHint: "bn" });
    expect(r.language).toBe("bn");
    expect(r.segments.length).toBeGreaterThan(0);
    for (let i = 1; i < r.segments.length; i++) {
      expect(r.segments[i]!.startMs).toBeGreaterThanOrEqual(r.segments[i - 1]!.endMs - 1000);
    }
    expect(r.segments[0]!.text).toMatch(/[ঀ-৿]/);
  });

  it("picks code-switch fixture by filename", async () => {
    const r = await provider.transcribeFile({ audio: audio("meeting-mixed.webm") });
    expect(r.language).toBe("mixed");
    const joined = r.segments.map((s) => s.text).join(" ");
    expect(joined).toMatch(/[ঀ-৿]/);
    expect(joined).toMatch(/[A-Za-z]{2,}/);
  });

  it("defaults to english", async () => {
    const r = await provider.transcribeFile({ audio: audio("standup.mp3") });
    expect(r.language).toBe("en");
  });

  it("requires API keys for real providers", () => {
    expect(() => createSttProvider({ STT_PROVIDER: "twinmind" })).toThrow(/TWINMIND_API_KEY/);
    expect(() => createSttProvider({ STT_PROVIDER: "openai" })).toThrow(/OPENAI_API_KEY/);
  });
});
