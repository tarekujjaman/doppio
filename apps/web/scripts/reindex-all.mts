import { prisma } from "@doppio/db";
import { indexSession } from "@/lib/pipeline/index-session";

/**
 * Backfill: re-index every READY session so the new sources (summary / notes /
 * actions) and the `kind` tag are present for Ask Doppio's global memory search.
 * Run with LLM_PROVIDER=openai so embeddings are real.
 */
async function main() {
  const sessions = await prisma.session.findMany({
    where: { status: "READY" },
    select: { id: true, title: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`Reindexing ${sessions.length} READY session(s) — LLM=${process.env.LLM_PROVIDER}\n`);
  let ok = 0;
  let fail = 0;
  for (const s of sessions) {
    try {
      const n = await indexSession(s.id);
      ok++;
      console.log(`✓ ${n.toString().padStart(3)} chunks  ${JSON.stringify(s.title?.slice(0, 44))}`);
    } catch (e) {
      fail++;
      console.log(`✗ ${s.id}: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log(`\nDone: ${ok} reindexed, ${fail} failed.`);
}

main()
  .catch((e) => { console.error("REINDEX FAILED:", e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());