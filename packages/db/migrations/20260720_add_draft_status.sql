-- Allow draft status on agent_looks (no column change needed — just extend the enum)
ALTER TABLE "agent_looks" ALTER COLUMN "status" DROP NOT NULL, ALTER COLUMN "status" SET DEFAULT 'draft';
-- Note: PostgreSQL text columns with app-level enums don't need ALTER TYPE
-- The enum is enforced at the app layer (drizzle), not the DB level
