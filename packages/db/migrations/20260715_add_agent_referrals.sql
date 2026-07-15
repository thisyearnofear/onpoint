-- Migration: Add agent referral tracking system
-- Adds referral_code column to orders and creates agent_referrals table

-- Add referral tracking to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS referral_code text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS referral_payout_tx_hash text;

-- Create agent_referrals table for commission tracking
CREATE TABLE IF NOT EXISTS agent_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_address text NOT NULL,
  referral_code text NOT NULL UNIQUE,
  order_id uuid NOT NULL REFERENCES orders(id),
  commission_cusd text NOT NULL,
  payout_tx_hash text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for fast referral lookups
CREATE INDEX IF NOT EXISTS idx_agent_referrals_agent_address ON agent_referrals(agent_address);
CREATE INDEX IF NOT EXISTS idx_agent_referrals_referral_code ON agent_referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_orders_referral_code ON orders(referral_code);
