import { randomUUID } from "node:crypto";
import { chunkSegments, createLLMClient } from "@doppio/ai";
import { prisma, Prisma } from "@doppio/db";

/**
 * RAG indexing (MVP-10, plan §M5): chunk the transcript (~800 chars, 100 overlap),
 * embed each chunk, store into RagChunk. The vector column is Unsupported in
 * Prisma, so inserts go through raw SQL with a pgvector literal.
 */
export async function indexSession(sessionId: string): Promise<number> {
  const segments = await prisma.transcriptSegment.findMany({
    where: { sessionId },
    orderBy: { idx: "asc" },
    select: { idx: true, startMs: true, text: true },
  });
  if (segments.length === 0) return 0;

  const chunks = chunkSegments(segments);
  if (chunks.length === 0) return 0;

  const llm = createLLMClient();
  const embeddings = await llm.embed(chunks.map((c) => c.text));

  await prisma.ragChunk.deleteMany({ where: { sessionId } });

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    const vector = `[${embeddings[i]!.join(",")}]`;
    await prisma.$executeRaw`
      INSERT INTO "RagChunk" (id, "sessionId", idx, text, "startMs", embedding)
      VALUES (${randomUUID()}, ${sessionId}, ${chunk.idx}, ${chunk.text}, ${chunk.startMs}, ${vector}::vector)
    `;
  }

  return chunks.length;
}

export interface RetrievedChunk {
  idx: number;
  text: string;
  startMs: number | null;
  score: number;
}

/** Top-k cosine retrieval within one session (single-session RAG, MVP-10). */
export async function retrieveChunks(
  sessionId: string,
  queryEmbedding: number[],
  k = 6,
): Promise<RetrievedChunk[]> {
  const vector = `[${queryEmbedding.join(",")}]`;
  return prisma.$queryRaw<RetrievedChunk[]>(
    Prisma.sql`
      SELECT idx, text, "startMs",
             1 - (embedding <=> ${vector}::vector) AS score
      FROM "RagChunk"
      WHERE "sessionId" = ${sessionId} AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vector}::vector
      LIMIT ${k}
    `,
  );
}
