-- Add metadata jsonb column to agent_looks for structured category/occasion/season
-- Populated by AI auto-classification or manual entry
-- Default to empty object so existing looks still work

ALTER TABLE "agent_looks" ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}' NOT NULL;

-- Add GIN index for metadata filtering (jsonb path ops)
CREATE INDEX IF NOT EXISTS "idx_agent_looks_metadata" ON "agent_looks" USING GIN ("metadata" jsonb_path_ops);
