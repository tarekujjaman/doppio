-- Detailed, sectioned markdown summary alongside the short overview.
ALTER TABLE "Summary" ADD COLUMN IF NOT EXISTS "detail" TEXT;