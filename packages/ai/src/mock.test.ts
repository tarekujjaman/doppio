import { FIXTURE_BANGLA, FIXTURE_ENGLISH } from "@doppio/stt";
import { describe, expect, it } from "vitest";
import { MockLLMClient } from "./mock";
import { SummarizeOutputSchema } from "./types";

const transcript = (segs: { text: string }[]) => segs.map((s) => s.text).join("\n");

describe("MockLLMClient", () => {
  const llm = new MockLLMClient();

  it("returns English JSON even for Bangla input (English-only summary contract)", async () => {
    const r = await llm.complete({
      system: "Return JSON.",
      user: transcript(FIXTURE_BANGLA.segments),
    });
    const parsed = SummarizeOutputSchema.safeParse(JSON.parse(r.text));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.overview).toMatch(/[A-Za-z]/);
      expect(parsed.data.overview).not.toMatch(/[ঀ-৿]/);
    }
  });

  it("returns English JSON for English input", async () => {
    const r = await llm.complete({
      system: "Return JSON.",
      user: transcript(FIXTURE_ENGLISH.segments),
    });
    const parsed = SummarizeOutputSchema.safeParse(JSON.parse(r.text));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.overview).not.toMatch(/[ঀ-৿]/);
  });

  it("embeds deterministically at 1536 dims", async () => {
    const [a, b] = await llm.embed(["hello", "hello"]);
    expect(a).toHaveLength(1536);
    expect(a).toEqual(b);
  });
});
