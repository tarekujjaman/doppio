export interface ChunkInput {
  idx: number;
  startMs: number;
  text: string;
}

export interface RagChunkData {
  idx: number;
  text: string;
  startMs: number;
}

/**
 * Greedy transcript chunking for RAG (plan §M5): ~800 chars per chunk with
 * ~100 chars of overlap, never splitting a segment. Each chunk carries the
 * startMs of its first segment so citations can seek the player.
 */
export function chunkSegments(
  segments: ChunkInput[],
  opts: { maxChars?: number; overlapChars?: number } = {},
): RagChunkData[] {
  const maxChars = opts.maxChars ?? 800;
  const overlapChars = opts.overlapChars ?? 100;

  const chunks: RagChunkData[] = [];
  let current: ChunkInput[] = [];
  let currentLen = 0;

  const flush = () => {
    if (current.length === 0) return;
    chunks.push({
      idx: chunks.length,
      text: current.map((s) => s.text).join(" "),
      startMs: current[0]!.startMs,
    });
  };

  for (const seg of segments) {
    if (currentLen > 0 && currentLen + seg.text.length > maxChars) {
      flush();
      // Overlap: carry trailing segments worth ~overlapChars into the next chunk.
      const carried: ChunkInput[] = [];
      let carriedLen = 0;
      for (let i = current.length - 1; i >= 0 && carriedLen < overlapChars; i--) {
        carried.unshift(current[i]!);
        carriedLen += current[i]!.text.length;
      }
      current = carried;
      currentLen = carriedLen;
    }
    current.push(seg);
    currentLen += seg.text.length;
  }
  flush();

  return chunks;
}
