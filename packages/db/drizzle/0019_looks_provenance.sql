-- Provenance for looks: studio (our composed fixtures), curator (real merchant
-- once supply lands), partner (outbound-routed). Everything existing is studio.
ALTER TABLE agent_looks ADD COLUMN IF NOT EXISTS provenance text NOT NULL DEFAULT 'studio';
