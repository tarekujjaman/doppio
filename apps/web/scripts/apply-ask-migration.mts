import { prisma } from "@doppio/db";

const STATEMENTS = [
  `ALTER TABLE "RagChunk" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'transcript'`,
  `ALTER TABLE "AskThread" ADD COLUMN IF NOT EXISTS "userId" UUID`,
  `ALTER TABLE "AskThread" ALTER COLUMN "sessionId" DROP NOT NULL`,
  `CREATE INDEX IF NOT EXISTS "AskThread_userId_idx" ON "AskThread" ("userId")`,
  `DO $$ BEGIN
     ALTER TABLE "AskThread" ADD CONSTRAINT "AskThread_userId_fkey"
       FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
];

async function main() {
  for (const sql of STATEMENTS) {
    await prisma.$executeRawUnsafe(sql);
    console.log("✓", sql.split("\n")[0]!.slice(0, 70));
  }
  const cols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
    `SELECT column_name FROM information_schema.columns WHERE table_name='AskThread'`,
  );
  console.log("\nAskThread columns:", cols.map((c) => c.column_name).join(", "));
}

main()
  .catch((e) => { console.error("MIGRATION FAILED:", e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());