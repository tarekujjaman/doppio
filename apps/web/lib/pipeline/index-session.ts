import { randomUUID } from "node:crypto";
import { chunkSegments, createLLMClient } from "@doppio/ai";
import { prisma, Prisma } from "@doppio/db";

interface IndexItem {
  text: string;
  startMs: number | null;
  kind: "transcript" | "summary" | "note" | "action";
}

/** Split long text into ~maxChars pieces on paragraph/sentence boundaries. */
function splitText(text: string, maxChars = 800): string[] {
  const clean = text.trim();
  if (clean.length <= maxChars) return clean ? [clean] : [];
  const parts: string[] = [];
  let buf = "";
  for (const para of clean.split(/\n{2,}/)) {
    if (buf.length + para.length > maxChars && buf) {
      parts.push(buf.trim());
      buf = "";
    }
    buf += (buf ? "\n\n" : "") + para;
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

/**
 * RAG indexing (MVP-10, plan §M5; extended for Ask Doppio global memory): chunk the
 * transcript (~800 chars, 100 overlap) AND index the summary, notes, and action items
 * so the whole session is searchable. Each chunk is tagged with `kind`. The vector
 * column is Unsupported in Prisma, so inserts go through raw SQL with a pgvector literal.
 */
export async function indexSession(sessionId: string): Promise<number> {
  const [segments, summary, notes, actions] = await Promise.all([
    prisma.transcriptSegment.findMany({
      where: { sessionId },
      orderBy: { idx: "asc" },
      select: { idx: true, startMs: true, text: true },
    }),
    prisma.summary.findUnique({
      where: { sessionId },
      select: { overview: true, detail: true, decisions: true, nextSteps: true },
    }),
    prisma.note.findMany({ where: { sessionId }, select: { text: true, anchorMs: true } }),
    prisma.actionItem.findMany({ where: { sessionId }, select: { text: true, owner: true, dueHint: true } }),
  ]);

  const items: IndexItem[] = [];

  // Transcript chunks (carry startMs for player-seek citations).
  for (const c of chunkSegments(segments)) {
    items.push({ text: c.text, startMs: c.startMs, kind: "transcript" });
  }

  // Summary (overview + detail + decisions + next steps).
  if (summary) {
    const summaryText = [
      summary.overview,
      summary.detail,
      summary.decisions ? `Decisions: ${summary.decisions}` : null,
      summary.nextSteps ? `Next steps: ${summary.nextSteps}` : null,
    ]
      .filter(Boolean)
      .join("\n\n");
    for (const piece of splitText(summaryText)) items.push({ text: piece, startMs: null, kind: "summary" });
  }

  // Notes (anchored to a timestamp when available).
  for (const n of notes) {
    if (n.text.trim()) items.push({ text: n.text, startMs: n.anchorMs ?? null, kind: "note" });
  }

  // Action items (with owner / due hint).
  for (const a of actions) {
    const t = [a.text, a.owner ? `(owner: ${a.owner})` : null, a.dueHint ? `(due: ${a.dueHint})` : null]
      .filter(Boolean)
      .join(" ");
    if (t.trim()) items.push({ text: t, startMs: null, kind: "action" });
  }

  if (items.length === 0) return 0;

  const llm = createLLMClient();
  const embeddings = await llm.embed(items.map((i) => i.text));

  await prisma.ragChunk.deleteMany({ where: { sessionId } });

  for (let i = 0; i < items.length; i++) {
    const it = items[i]!;
    const vector = `[${embeddings[i]!.join(",")}]`;
    await prisma.$executeRaw`
      INSERT INTO "RagChunk" (id, "sessionId", idx, text, "startMs", kind, embedding)
      VALUES (${randomUUID()}, ${sessionId}, ${i}, ${it.text}, ${it.startMs}, ${it.kind}, ${vector}::vector)
    `;
  }

  return items.length;
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

export interface GlobalChunk {
  text: string;
  startMs: number | null;
  kind: string;
  sessionId: string;
  sessionTitle: string;
  score: number;
}

/**
 * Top-k cosine retrieval across ALL of a user's sessions (Ask Doppio global memory).
 * Joins Session so results are strictly scoped to the user and carry the source
 * session's title + timestamp for citation. Uses the table-wide ivfflat index.
 */
export async function retrieveChunksGlobal(
  userId: string,
  queryEmbedding: number[],
  k = 8,
): Promise<GlobalChunk[]> {
  const vector = `[${queryEmbedding.join(",")}]`;
  return prisma.$queryRaw<GlobalChunk[]>(
    Prisma.sql`
      SELECT rc.text, rc."startMs", rc.kind, rc."sessionId",
             s.title AS "sessionTitle",
             1 - (rc.embedding <=> ${vector}::vector) AS score
      FROM "RagChunk" rc
      JOIN "Session" s ON s.id = rc."sessionId"
      WHERE s."userId" = ${userId}::uuid AND rc.embedding IS NOT NULL
      ORDER BY rc.embedding <=> ${vector}::vector
      LIMIT ${k}
    `,
  );
}