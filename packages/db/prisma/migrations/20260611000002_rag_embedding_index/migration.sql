-- ANN index for Ask Doppio top-k retrieval (cosine distance).
CREATE INDEX IF NOT EXISTS "RagChunk_embedding_ivfflat"
  ON "RagChunk" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);