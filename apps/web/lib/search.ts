import { prisma, Prisma } from "@doppio/db";

export interface SearchHit {
  sessionId: string;
  sessionTitle: string;
  kind: "segment" | "note" | "title";
  startMs: number | null;
  /** Snippet with [[m]]…[[/m]] highlight markers (rendered safely in React). */
  snippet: string;
}

/** MVP-08: FTS over segments + notes + titles ('simple' config), trgm fallback. */
export async function searchAll(input: {
  userId: string;
  q: string;
  from?: Date | null;
  to?: Date | null;
}): Promise<SearchHit[]> {
  const { userId, q, from, to } = input;

  const dateFilter = Prisma.sql`
    ${from ? Prisma.sql`AND s."createdAt" >= ${from}` : Prisma.empty}
    ${to ? Prisma.sql`AND s."createdAt" <= ${to}` : Prisma.empty}
  `;

  const headline = (col: Prisma.Sql) => Prisma.sql`
    ts_headline('simple', ${col}, websearch_to_tsquery('simple', ${q}),
      'StartSel=[[m]], StopSel=[[/m]], MaxWords=25, MinWords=10')
  `;

  const [titleHits, segmentHits, noteHits] = await Promise.all([
    prisma.$queryRaw<SearchHit[]>(Prisma.sql`
      SELECT s.id AS "sessionId", s.title AS "sessionTitle", 'title' AS kind,
             NULL::int AS "startMs", s.title AS snippet
      FROM "Session" s
      WHERE s."userId" = ${userId}::uuid AND s.title ILIKE ${"%" + q + "%"}
        ${dateFilter}
      ORDER BY s."createdAt" DESC
      LIMIT 10
    `),
    prisma.$queryRaw<SearchHit[]>(Prisma.sql`
      SELECT s.id AS "sessionId", s.title AS "sessionTitle", 'segment' AS kind,
             seg."startMs" AS "startMs", ${headline(Prisma.sql`seg.text`)} AS snippet
      FROM "TranscriptSegment" seg
      JOIN "Session" s ON s.id = seg."sessionId"
      WHERE s."userId" = ${userId}::uuid
        AND to_tsvector('simple', seg.text) @@ websearch_to_tsquery('simple', ${q})
        ${dateFilter}
      ORDER BY s."createdAt" DESC, seg.idx ASC
      LIMIT 30
    `),
    prisma.$queryRaw<SearchHit[]>(Prisma.sql`
      SELECT s.id AS "sessionId", s.title AS "sessionTitle", 'note' AS kind,
             n."anchorMs" AS "startMs", ${headline(Prisma.sql`n.text`)} AS snippet
      FROM "Note" n
      JOIN "Session" s ON s.id = n."sessionId"
      WHERE s."userId" = ${userId}::uuid
        AND to_tsvector('simple', n.text) @@ websearch_to_tsquery('simple', ${q})
        ${dateFilter}
      ORDER BY s."createdAt" DESC
      LIMIT 10
    `),
  ]);

  let hits = [...titleHits, ...segmentHits, ...noteHits];

  // Substring fallback for partial words (esp. Bangla morphology).
  if (hits.length === 0) {
    hits = await prisma.$queryRaw<SearchHit[]>(Prisma.sql`
      SELECT s.id AS "sessionId", s.title AS "sessionTitle", 'segment' AS kind,
             seg."startMs" AS "startMs", seg.text AS snippet
      FROM "TranscriptSegment" seg
      JOIN "Session" s ON s.id = seg."sessionId"
      WHERE s."userId" = ${userId}::uuid AND seg.text ILIKE ${"%" + q + "%"}
        ${dateFilter}
      ORDER BY s."createdAt" DESC, seg.idx ASC
      LIMIT 30
    `);
  }

  return hits;
}
