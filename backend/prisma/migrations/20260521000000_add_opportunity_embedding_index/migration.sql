-- Re-add HNSW index on Opportunity.embedding for fast vector similarity search.
-- The index was dropped in 20260402164342 but the column and data remain intact.
CREATE INDEX IF NOT EXISTS "Opportunity_embedding_idx"
ON "Opportunity"
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
