import { createLLMClient } from "@doppio/ai";
import { prisma } from "@doppio/db";
import { retrieveChunksGlobal } from "@/lib/pipeline/index-session";

async function main() {
  const email = process.env.RECOVER_EMAIL ?? "riad.celloscope@gmail.com";
  const user = await prisma.user.findFirst({ where: { email }, select: { id: true } });
  if (!user) throw new Error(`no user for ${email}`);
  const q = process.argv[2] ?? "What was discussed about the dispatch meetings and what did we decide?";
  const llm = createLLMClient();
  const [emb] = await llm.embed([q]);
  const chunks = await retrieveChunksGlobal(user.id, emb!, 8);
  console.log(`Q: ${q}\nuser=${user.id}  →  ${chunks.length} chunks:\n`);
  for (const c of chunks) {
    console.log(
      `  [${c.score.toFixed(3)}] ${c.kind.padEnd(10)} ${JSON.stringify(c.sessionTitle?.slice(0, 32))}` +
        `  :: ${c.text.slice(0, 70).replace(/\s+/g, " ")}`,
    );
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());