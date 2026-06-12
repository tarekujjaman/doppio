-- MVP-08: full-text search over transcript segments, notes, and titles.
-- 'simple' config tokenizes Bangla tolerably; pg_trgm covers substring fallback.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "TranscriptSegment_text_fts"
  ON "TranscriptSegment" USING gin (to_tsvector('simple', text));

CREATE INDEX IF NOT EXISTS "Note_text_fts"
  ON "Note" USING gin (to_tsvector('simple', text));

CREATE INDEX IF NOT EXISTS "Session_title_trgm"
  ON "Session" USING gin (title gin_trgm_ops);
