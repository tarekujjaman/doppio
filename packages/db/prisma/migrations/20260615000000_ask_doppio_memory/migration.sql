-- Ask Doppio (global memory chat): tag chunks by source + allow a user-scoped Ask thread.

-- RagChunk now indexes more than transcripts (summary / note / action).
ALTER TABLE "RagChunk" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'transcript';

-- AskThread can be the user's global "Ask Doppio" memory thread:
--   per-session thread  → sessionId set, userId null
--   global memory thread → userId set, sessionId null
ALTER TABLE "AskThread" ADD COLUMN IF NOT EXISTS "userId" UUID;
ALTER TABLE "AskThread" ALTER COLUMN "sessionId" DROP NOT NULL;
CREATE INDEX IF NOT EXISTS "AskThread_userId_idx" ON "AskThread" ("userId");

DO $$ BEGIN
  ALTER TABLE "AskThread" ADD CONSTRAINT "AskThread_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
