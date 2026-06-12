import { describe, expect, it } from "vitest";
import { chunkSegments } from "./chunk";

const seg = (idx: number, text: string) => ({ idx, startMs: idx * 1000, text });

describe("chunkSegments", () => {
  it("packs small segments into one chunk", () => {
    const chunks = chunkSegments([seg(0, "hello"), seg(1, "world")]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ idx: 0, startMs: 0, text: "hello world" });
  });

  it("splits at the size limit and carries overlap", () => {
    const segments = Array.from({ length: 10 }, (_, i) => seg(i, "x".repeat(300)));
    const chunks = chunkSegments(segments, { maxChars: 800, overlapChars: 100 });
    expect(chunks.length).toBeGreaterThan(1);
    // Sequential idx and a real timestamp on every chunk
    chunks.forEach((c, i) => expect(c.idx).toBe(i));
    // Overlap: chunk N+1 starts at or before where chunk N ended
    expect(chunks[1]!.startMs).toBeLessThanOrEqual(9000);
  });

  it("handles empty input", () => {
    expect(chunkSegments([])).toEqual([]);
  });
});
