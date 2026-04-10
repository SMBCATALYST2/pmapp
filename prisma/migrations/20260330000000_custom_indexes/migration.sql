-- Custom indexes that cannot be expressed in Prisma schema
-- These are applied after the initial Prisma migration

-- Critique revision: GIN index for full-text search on issue title and description text
-- This enables PostgreSQL tsvector-based search on issues
CREATE INDEX IF NOT EXISTS "Issue_fulltext_search_idx"
  ON "Issue" USING GIN (to_tsvector('english', coalesce("title", '') || ' ' || coalesce("descriptionText", '')));

-- GIN index for full-text search on comment body text
CREATE INDEX IF NOT EXISTS "Comment_fulltext_search_idx"
  ON "Comment" USING GIN (to_tsvector('english', coalesce("bodyText", '')));
